@file:Suppress("DEPRECATION")
package com.sensering.app

import android.content.Intent
import android.media.AudioManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioFocusRequest
import android.media.AudioTrack
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.lifecycle.Lifecycle
import com.sensering.core.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class AppSmokeTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Before fun openDashboard(){rule.dismissIntro()}
    @After fun cleanTestData(){rule.runOnIdle{
        rule.activity.ringRuntime.store.update{AppConfiguration()}
        rule.activity.ringRuntime.clearActivity()
        rule.activity.ringRuntime.notice(null)
    }}
    @Test fun nativeTabsAndProfileEditingWork() {
        rule.onNodeWithText("Dashboard").assertIsDisplayed()
        rule.onNodeWithContentDescription("Controls").performClick()
        rule.onNodeWithText("Your controls").assertIsDisplayed()
        rule.onNodeWithContentDescription("Manage profiles").performClick()
        rule.onNodeWithText("Save as").performClick()
        rule.onNodeWithText("Profile name").performTextInput("Lecture")
        rule.onNodeWithText("Save",useUnmergedTree=true).performClick()
        rule.onNodeWithText("Lecture").assertIsDisplayed()
        rule.onNodeWithContentDescription("Settings").performClick()
        rule.onNodeWithText("Touch-control access").performScrollTo().performClick()
        rule.onNodeWithText("Allow app controls").assertIsDisplayed()
        rule.onNodeWithText("Cancel").performClick()
    }
    @Test fun previewsStayLocalAndNeverStartAConnection() {
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Try your controls"))
        rule.onNodeWithText("Try your controls").performClick()
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Single tap"))
        rule.onNodeWithText("Single tap").performClick()
        rule.runOnIdle {
            val runtime=rule.activity.ringRuntime
            assertEquals("Preview",runtime.current.activities.first().detail)
            assertTrue(runtime.current.activities.first().preview)
            assertFalse(runtime.current.serviceRunning)
            assertNull(runtime.client)
        }
    }
    @Test fun backgroundConnectionCanOutliveTheScreen() {
        val context=rule.activity.applicationContext
        val runtime=context.ringRuntime
        val audio=context.getSystemService(AudioManager::class.java)
        val previous=audio.getStreamVolume(AudioManager.STREAM_MUSIC)
        try {
            rule.runOnIdle { RingConnectionService.start(context,"12:34:56:78:9A:BC") }
            rule.waitUntil(timeoutMillis=5000){runtime.current.serviceRunning}
            rule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
            assertTrue(runtime.current.serviceRunning)
            assertNotNull(runtime.client)
            val target=minOf(3,audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)-1)
            audio.setStreamVolume(AudioManager.STREAM_MUSIC,target,0)
            var result=""
            runtime.dispatcher.execute(RingAction.VOL_UP,AppConfiguration(),{true}){result=it}
            assertEquals("Sent",result)
            rule.waitUntil(timeoutMillis=2000){audio.getStreamVolume(AudioManager.STREAM_MUSIC)==target+1}
            assertEquals(target+1,audio.getStreamVolume(AudioManager.STREAM_MUSIC))
        } finally {
            RingConnectionService.disconnect(context)
            audio.setStreamVolume(AudioManager.STREAM_MUSIC,previous,0)
            rule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
            rule.waitUntil(timeoutMillis=5000){!runtime.current.serviceRunning}
        }
    }
    @Test fun nativeMediaCommandsReachTheActiveAndroidMediaSession() {
        val received=CountDownLatch(1)
        val session=MediaSession(rule.activity,"SenseRing native routing test")
        val audio=rule.activity.getSystemService(AudioManager::class.java)
        val attributes=AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()
        val focus=AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setOnAudioFocusChangeListener({ },Handler(Looper.getMainLooper())).build()
        val frames=44100
        val track=AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(AudioFormat.Builder().setSampleRate(frames).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
            .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(frames*2).build()
        try {
            session.setCallback(object:MediaSession.Callback(){
                override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
                    val event=mediaButtonIntent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    if(event?.keyCode==KeyEvent.KEYCODE_MEDIA_NEXT&&event.action==KeyEvent.ACTION_DOWN)received.countDown()
                    return true
                }
            },Handler(Looper.getMainLooper()))
            session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS)
            session.setPlaybackState(PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING,0,1f).setActions(PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_PLAY_PAUSE).build())
            session.isActive=true
            assertEquals(AudioManager.AUDIOFOCUS_REQUEST_GRANTED,audio.requestAudioFocus(focus))
            track.write(ShortArray(frames),0,frames);track.setLoopPoints(0,frames,-1);track.setVolume(0f);track.play()
            rule.waitUntil(timeoutMillis=5000){audio.isMusicActive}
            rule.activity.ringRuntime.dispatcher.execute(RingAction.NEXT,AppConfiguration(),{true}){}
            assertTrue("Android did not route the media key to the active session",received.await(5,TimeUnit.SECONDS))
        } finally {track.stop();track.release();audio.abandonAudioFocusRequest(focus);session.isActive=false;session.release()}
    }
    @Test fun restartingRestoresOnlyTheConnectionTheUserKeptEnabled() {
        val context=rule.activity.applicationContext
        val runtime=context.ringRuntime
        val receiver=RingResumeReceiver()
        try {
            rule.runOnIdle {
                runtime.store.update{it.copy(address="12:34:56:78:9A:BC",backgroundWanted=false)}
                receiver.onReceive(context,Intent(Intent.ACTION_BOOT_COMPLETED))
                assertFalse(runtime.current.serviceRunning)
                runtime.store.update{it.copy(backgroundWanted=true)}
                receiver.onReceive(context,Intent(Intent.ACTION_MY_PACKAGE_REPLACED))
            }
            rule.waitUntil(timeoutMillis=5000){runtime.current.serviceRunning}
            assertNotNull(runtime.client)
        } finally {
            RingConnectionService.disconnect(context)
            rule.waitUntil(timeoutMillis=5000){!runtime.current.serviceRunning}
        }
    }
    @Test fun volumeUsesTheMusicStreamAndDeliveryCanBeCancelled() {
        val audio=rule.activity.getSystemService(AudioManager::class.java)
        val previous=audio.getStreamVolume(AudioManager.STREAM_MUSIC)
        try {
            val target=minOf(3,audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)-1)
            audio.setStreamVolume(AudioManager.STREAM_MUSIC,target,0)
            var result=""
            rule.activity.ringRuntime.dispatcher.execute(RingAction.VOL_UP,AppConfiguration(),{false}){result=it}
            assertEquals("Not sent",result);assertEquals(target,audio.getStreamVolume(AudioManager.STREAM_MUSIC))
            rule.activity.ringRuntime.dispatcher.execute(RingAction.VOL_UP,AppConfiguration(),{true}){result=it}
            assertEquals("Sent",result)
            rule.waitUntil(timeoutMillis=2000){audio.getStreamVolume(AudioManager.STREAM_MUSIC)==target+1}
            assertEquals(target+1,audio.getStreamVolume(AudioManager.STREAM_MUSIC))
        } finally {audio.setStreamVolume(AudioManager.STREAM_MUSIC,previous,0)}
    }
}
