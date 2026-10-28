package com.sensering.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Path
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.sensering.core.*

class PhoneActionDispatcher(private val context: Context) {
    private val audio=context.getSystemService(AudioManager::class.java)
    private val main=Handler(Looper.getMainLooper())
    fun execute(action: RingAction,config: AppConfiguration,valid: () -> Boolean,result: (String) -> Unit) {
        if(!valid()){result("Not sent");return}
        if(action.isPresentation){
            main.post {
                if(!valid()){result("Not sent");return@post}
                val service=RingAccessibilityService.instance
                if(service==null)result("Enable app-control access")
                else service.performRingAction(action,config,valid,result)
            }
            return
        }
        try {
            when(action){
                RingAction.VOL_UP,RingAction.VOL_DOWN -> {
                    if(audio.isVolumeFixed){result("This output has fixed volume");return}
                    val stream=when(audio.mode){
                        AudioManager.MODE_IN_CALL,AudioManager.MODE_IN_COMMUNICATION->AudioManager.STREAM_VOICE_CALL
                        AudioManager.MODE_RINGTONE->AudioManager.STREAM_RING
                        else->AudioManager.STREAM_MUSIC
                    }
                    audio.adjustStreamVolume(stream,if(action==RingAction.VOL_UP)AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER,AudioManager.FLAG_SHOW_UI)
                }
                else -> {
                    val key=when(action){RingAction.PLAY_PAUSE->KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;RingAction.NEXT->KeyEvent.KEYCODE_MEDIA_NEXT;RingAction.PREV->KeyEvent.KEYCODE_MEDIA_PREVIOUS;else->return}
                    val now=SystemClock.uptimeMillis()
                    audio.dispatchMediaKeyEvent(KeyEvent(now,now,KeyEvent.ACTION_DOWN,key,0))
                    audio.dispatchMediaKeyEvent(KeyEvent(now,now,KeyEvent.ACTION_UP,key,0))
                }
            }
            result("Sent")
        }catch(_:SecurityException){result("Android blocked this audio change")}
    }
}

internal fun presentationStroke(action:RingAction,style:SlideStyle,width:Float,height:Float):GestureDescription.StrokeDescription {
    val path=Path();var duration=170L
    when {
        action==RingAction.SELECT -> {path.moveTo(width*.5f,height*.5f);duration=60}
        action==RingAction.SCROLL_DOWN -> {path.moveTo(width*.5f,height*.72f);path.lineTo(width*.5f,height*.30f)}
        action==RingAction.SCROLL_UP -> {path.moveTo(width*.5f,height*.30f);path.lineTo(width*.5f,height*.72f)}
        style==SlideStyle.TAP_EDGES -> {path.moveTo(width*(if(action==RingAction.SLIDE_NEXT).85f else .15f),height*.5f);duration=60}
        style==SlideStyle.SWIPE_VERTICAL&&action==RingAction.SLIDE_NEXT -> {path.moveTo(width*.5f,height*.80f);path.lineTo(width*.5f,height*.20f)}
        style==SlideStyle.SWIPE_VERTICAL -> {path.moveTo(width*.5f,height*.20f);path.lineTo(width*.5f,height*.80f)}
        action==RingAction.SLIDE_NEXT -> {path.moveTo(width*.80f,height*.50f);path.lineTo(width*.20f,height*.50f)}
        else -> {path.moveTo(width*.20f,height*.50f);path.lineTo(width*.80f,height*.50f)}
    }
    return GestureDescription.StrokeDescription(path,0,duration)
}

class RingAccessibilityService : AccessibilityService() {
    companion object { @Volatile var instance: RingAccessibilityService?=null; private set }
    private var foregroundPackage: String?=null
    private var gestureInFlight=false
    override fun onServiceConnected(){instance=this}
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if(event?.eventType==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)foregroundPackage=event.packageName?.toString()
    }
    override fun onInterrupt(){gestureInFlight=false}
    override fun onDestroy(){if(instance===this)instance=null;super.onDestroy()}
    fun performRingAction(action: RingAction,config: AppConfiguration,valid: () -> Boolean,result: (String) -> Unit) {
        if(!valid()){result("Not sent");return}
        when(PhoneControlPolicy.touchBlock(getSystemService(KeyguardManager::class.java).isKeyguardLocked,getSystemService(PowerManager::class.java).isInteractive,config.touchScope,config.presentationPackage,foregroundPackage)){
            TouchBlock.LOCKED->{result("Unlock your phone for touch controls");return}
            TouchBlock.SCREEN_OFF->{result("Wake the screen for touch controls");return}
            TouchBlock.CHOOSE_APP->{result("Choose an app or use All apps");return}
            TouchBlock.OPEN_CHOSEN_APP->{result("Open ${config.presentationName}");return}
            TouchBlock.NONE->Unit
        }
        if(gestureInFlight){result("Touch control busy");return}
        if(config.slideStyle==SlideStyle.ARROW_KEYS&&Build.VERSION.SDK_INT>=33){
            val id=when(action){
                RingAction.SLIDE_NEXT->GLOBAL_ACTION_DPAD_RIGHT
                RingAction.SLIDE_PREV->GLOBAL_ACTION_DPAD_LEFT
                RingAction.SCROLL_DOWN->GLOBAL_ACTION_DPAD_DOWN
                RingAction.SCROLL_UP->GLOBAL_ACTION_DPAD_UP
                else->GLOBAL_ACTION_DPAD_CENTER
            }
            if(systemActions.any{it.id==id}&&performGlobalAction(id)){result("Sent");return}
        }
        val width=resources.displayMetrics.widthPixels.toFloat()
        val height=resources.displayMetrics.heightPixels.toFloat()
        val stroke=presentationStroke(action,config.slideStyle,width,height)
        if(!valid()){result("Not sent");return}
        gestureInFlight=true
        val gesture=GestureDescription.Builder().addStroke(stroke).build()
        val accepted=dispatchGesture(gesture,object:GestureResultCallback(){
            override fun onCompleted(gestureDescription: GestureDescription?){gestureInFlight=false;result(if(valid())"Sent" else "Unconfirmed")}
            override fun onCancelled(gestureDescription: GestureDescription?){gestureInFlight=false;result("Not completed")}
        },null)
        if(!accepted){gestureInFlight=false;result("Touch control unavailable")}
    }
}
