package com.sensering.app

import android.app.Application
import android.content.Context
import android.os.SystemClock
import com.sensering.core.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.atomic.AtomicLong

class SenseRingApplication : Application() {
    lateinit var runtime: RingRuntime
        private set
    override fun onCreate() { super.onCreate(); runtime = RingRuntime(this) }
}
val Context.ringRuntime: RingRuntime get() = (applicationContext as SenseRingApplication).runtime

enum class LinkState(val title: String) {
    DISCONNECTED("Disconnected"), CONNECTING("Connecting"), SYNCING("Getting ready"), READY("Connected"),
    RECONNECTING("Reconnecting"), BLUETOOTH_OFF("Bluetooth is off"), SLEEPING("Ring asleep")
}
data class RingActivity(val id: Long, val input: String, val action: RingAction, val detail: String, val time: String, val preview: Boolean = false)
data class RingState(
    val connection: LinkState = LinkState.DISCONNECTED, val mode: RingMode? = null, val pendingMode: RingMode? = null,
    val session: Long = 0, val serviceRunning: Boolean = false, val firmware: String? = null,
    val notice: String? = null, val activities: List<RingActivity> = emptyList()
)
class RingRuntime(private val context: Context) {
    val store = AppStore(context)
    private val mutable = MutableStateFlow(RingState())
    val state = mutable.asStateFlow()
    val current get() = mutable.value
    @Volatile var client: RingBleClient? = null
    private val activityIds = AtomicLong()
    private val actionEpoch = AtomicLong()
    private val timeFormat = DateTimeFormatter.ofPattern("h:mm a")
    val dispatcher = PhoneActionDispatcher(context)

    fun updateConnection(value: LinkState, session: Long) {
        actionEpoch.incrementAndGet()
        mutable.update { it.copy(connection=value,session=session,pendingMode=null,mode=if(value==LinkState.DISCONNECTED||value==LinkState.SLEEPING)null else it.mode) }
    }
    fun serviceRunning(running: Boolean) { mutable.update { it.copy(serviceRunning=running) } }
    fun firmware(value: String?) { if(value!=null&&Regex("[a-zA-Z0-9._-]{1,48}").matches(value)) mutable.update { it.copy(firmware=value) } }
    fun mode(mode: RingMode) { actionEpoch.incrementAndGet(); mutable.update { it.copy(mode=mode,pendingMode=null) } }
    fun pendingMode(mode: RingMode) { actionEpoch.incrementAndGet(); mutable.update { it.copy(pendingMode=mode) } }
    fun clearPendingMode() { mutable.update { it.copy(pendingMode=null) } }
    fun notice(message: String?) { mutable.update { it.copy(notice=message) } }
    fun invalidateActions() { actionEpoch.incrementAndGet() }
    fun requestMode(mode: RingMode) {
        if(current.connection==LinkState.READY) client?.setMode(mode)
        else if(current.connection==LinkState.DISCONNECTED||current.connection==LinkState.SLEEPING) this.mode(mode)
    }
    fun sleep() { invalidateActions();client?.sleep() }
    fun onGesture(message: RingMessage.Gesture, session: Long, received: Long) {
        val snapshot=current
        val delivery=DeliveryContext(snapshot.session,snapshot.connection==LinkState.READY&&snapshot.serviceRunning&&store.current.backgroundWanted,snapshot.mode,snapshot.pendingMode!=null,snapshot.connection==LinkState.SLEEPING)
        if(!DeliveryPolicy.allows(delivery,message,session,received,SystemClock.elapsedRealtime())) return
        val action=store.current.profiles.active().action(message.mode,message.input)
        val epoch=actionEpoch.get()
        // Command first: native delivery begins before publishing UI/history updates.
        dispatcher.execute(action,store.current,{ epoch==actionEpoch.get() && current.session==session && current.connection==LinkState.READY &&
            current.pendingMode==null && current.mode==message.mode && store.current.backgroundWanted && current.serviceRunning &&
            SystemClock.elapsedRealtime()-received<=DeliveryPolicy.MAX_AGE_MS }) { result ->
            if(epoch==actionEpoch.get()) addActivity(message.input.label,action,result)
        }
    }
    fun preview(mode: RingMode, input: RingInput) {
        addActivity(input.label,store.current.profiles.active().action(mode,input),"Preview",true)
    }
    private fun addActivity(input: String,action: RingAction,detail: String,preview: Boolean=false) {
        val record=RingActivity(activityIds.incrementAndGet(),input,action,detail,LocalTime.now().format(timeFormat),preview)
        mutable.update { it.copy(activities=(listOf(record)+it.activities).take(10)) }
    }
    fun clearActivity() { mutable.update { it.copy(activities=emptyList()) } }
}
