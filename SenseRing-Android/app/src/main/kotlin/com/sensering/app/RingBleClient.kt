@file:Suppress("DEPRECATION","OVERRIDE_DEPRECATION")
package com.sensering.app

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.*
import androidx.core.content.ContextCompat
import com.sensering.core.*
import org.json.JSONObject
import java.util.UUID

@SuppressLint("MissingPermission")
class RingBleClient(private val context: Context,private val runtime: RingRuntime,private val onState: () -> Unit) {
    private val thread=HandlerThread("SenseRing-BLE").apply { start() }
    private val handler=Handler(thread.looper)
    private val adapter=context.getSystemService(BluetoothManager::class.java)?.adapter
    private var gatt: BluetoothGatt?=null
    private var event: BluetoothGattCharacteristic?=null
    private var status: BluetoothGattCharacteristic?=null
    private var session=0L
    private var subscribed=false
    private var confirmedMode: RingMode?=null
    private var desiredMode: RingMode?=null
    private var address: String?=null
    @Volatile private var closed=false
    private var intentional=false
    private var lastToken=""
    private var lastTokenAt=0L
    private val backoff=ReconnectBackoff()
    private val operations=ArrayDeque<Operation>()
    private var active: Operation?=null
    private data class Operation(val key: String,val start: () -> Boolean,val complete: (Boolean,ByteArray?) -> Unit)
    private val operationTimeout=Runnable { failed("The ring stopped responding. Reconnecting.") }
    private val connectTimeout=Runnable { failed("Couldn’t connect. Keep the ring close and awake.") }
    private val syncTimeout=Runnable { if(confirmedMode==null)failed("Couldn’t read the ring’s mode. Reconnecting.") }
    private val modeTimeout=Runnable {
        if(desiredMode!=null){desiredMode=null;runtime.clearPendingMode();runtime.notice("The ring didn’t confirm the mode change. Try again.")}
    }
    private val reconnect=Runnable { if(!closed&&!intentional&&runtime.store.current.backgroundWanted)connectNow() }
    fun connect(value: String) { handler.post { address=value;intentional=false;handler.removeCallbacks(reconnect);connectNow() } }
    fun bluetoothChanged(enabled: Boolean) { handler.post {
        if(enabled&&!closed&&!intentional&&runtime.store.current.backgroundWanted)connectNow()
        else if(!enabled){closeLink();runtime.updateConnection(LinkState.BLUETOOTH_OFF,session);onState()}
    } }
    private fun allowed() = Build.VERSION.SDK_INT<31||ContextCompat.checkSelfPermission(context,Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED
    private fun connectNow() {
        if(closed||intentional)return
        closeLink()
        if(!allowed()){runtime.notice("Allow Nearby devices to connect your ring.");runtime.updateConnection(LinkState.DISCONNECTED,session);onState();return}
        if(adapter?.isEnabled!=true){runtime.updateConnection(LinkState.BLUETOOTH_OFF,session);onState();return}
        val target=address?:return
        runtime.notice(null);runtime.updateConnection(LinkState.CONNECTING,session);onState()
        try {
            gatt=adapter.getRemoteDevice(target).connectGatt(context,false,callback,BluetoothDevice.TRANSPORT_LE)
            if(gatt==null){failed("Couldn’t open the Bluetooth connection.");return}
            handler.postDelayed(connectTimeout,15000)
        }catch(_:SecurityException){failed("Allow Nearby devices to reconnect your ring.")}
        catch(_:IllegalArgumentException){runtime.notice("Choose your ring again.");intentional=true;runtime.updateConnection(LinkState.DISCONNECTED,session);onState()}
    }
    private fun closeLink() {
        session++;handler.removeCallbacks(connectTimeout);handler.removeCallbacks(operationTimeout)
        handler.removeCallbacks(syncTimeout);handler.removeCallbacks(modeTimeout)
        operations.clear();active=null;subscribed=false;confirmedMode=null;desiredMode=null;event=null;status=null;lastToken="";lastTokenAt=0
        val old=gatt;gatt=null
        try{old?.disconnect();old?.close()}catch(_:SecurityException){}
    }
    private fun failed(message: String) {
        if(closed)return
        closeLink();runtime.notice(message)
        val retry=!intentional&&runtime.store.current.backgroundWanted
        runtime.updateConnection(if(retry)LinkState.RECONNECTING else LinkState.DISCONNECTED,session);onState()
        if(retry){handler.removeCallbacks(reconnect);handler.postDelayed(reconnect,backoff.nextMs())}
    }
    private fun enqueue(operation: Operation) {
        if(operations.size>=8){failed("The ring connection is busy. Reconnecting.");return}
        operations.addLast(operation);drain()
    }
    private fun drain() {
        if(active!=null||gatt==null||operations.isEmpty())return
        val operation=operations.removeFirst();active=operation
        handler.postDelayed(operationTimeout,4000)
        val started=runCatching { operation.start() }.getOrDefault(false)
        if(!started)finish(operation.key,false,null)
    }
    private fun finish(key: String,success: Boolean,value: ByteArray?) {
        if(closed)return
        val operation=active?:return
        if(operation.key!=key)return
        active=null;handler.removeCallbacks(operationTimeout)
        operation.complete(success,value);drain()
    }
    private fun write(text: String,done: (Boolean) -> Unit = {}) {
        val target=event?:run{done(false);return}
        val payload=text.toByteArray(Charsets.UTF_8)
        enqueue(Operation("write",{
            val current=gatt?:return@Operation false
            if(Build.VERSION.SDK_INT>=33)current.writeCharacteristic(target,payload,BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)==BluetoothStatusCodes.SUCCESS
            else {target.writeType=BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;target.value=payload;current.writeCharacteristic(target)}
        },{ok,_->done(ok)}))
    }
    private fun readStatus(fallback: Boolean=false) {
        val target=status
        if(target==null){if(fallback)write("GET_MODE");return}
        enqueue(Operation("read",{gatt?.readCharacteristic(target)==true},{ok,value ->
            val mode=if(ok&&value!=null)runCatching {
                val json=JSONObject(value.toString(Charsets.UTF_8));runtime.firmware(json.optString("fw").takeIf{it.isNotBlank()})
                RingMode.fromId(json.optString("mode"))
            }.getOrNull() else null
            if(mode!=null&&(confirmedMode==null||desiredMode==mode))acceptMode(mode)
            else if(fallback&&confirmedMode==null)write("GET_MODE")
        }))
    }
    private fun acceptMode(mode: RingMode) {
        if(closed||intentional)return
        confirmedMode=mode;desiredMode=null;handler.removeCallbacks(modeTimeout);handler.removeCallbacks(syncTimeout)
        runtime.mode(mode)
        if(subscribed){handler.removeCallbacks(connectTimeout);backoff.reset();runtime.updateConnection(LinkState.READY,session);runtime.mode(mode);runtime.notice(null);onState()}
    }
    private fun token(value: ByteArray,received: Long) {
        if(closed||intentional)return
        val raw=value.toString(Charsets.UTF_8).trim()
        if(raw==lastToken&&received-lastTokenAt<20)return
        lastToken=raw;lastTokenAt=received
        when(val message=RingProtocol.decode(raw)){
            is RingMessage.ModeChanged -> acceptMode(message.mode)
            is RingMessage.Gesture -> runtime.onGesture(message,session,received)
            null -> Unit
        }
    }
    fun setMode(mode: RingMode) { handler.post {
        if(closed||!subscribed||desiredMode!=null||runtime.current.connection!=LinkState.READY)return@post
        desiredMode=mode;runtime.pendingMode(mode);handler.postDelayed(modeTimeout,4000)
        write(mode.command){ok->if(ok)handler.postDelayed({readStatus()},160) else {desiredMode=null;runtime.clearPendingMode();runtime.notice("Couldn’t change mode. Try again.")}}
    } }
    fun sleep() { handler.post {
        if(closed||gatt==null)return@post
        intentional=true;runtime.updateConnection(LinkState.SLEEPING,session);onState()
        write("SLEEP"){ok->
            if(!ok){intentional=false;failed("Couldn’t put the ring to sleep. Try again.")}
            else {runtime.store.update{it.copy(backgroundWanted=false)};onState();handler.postDelayed({closeLink();runtime.updateConnection(LinkState.SLEEPING,session);onState()},1000)}
        }
    } }
    fun close() { closed=true;handler.post {intentional=true;handler.removeCallbacksAndMessages(null);closeLink();thread.quitSafely()} }

    private val callback=object:BluetoothGattCallback(){
        override fun onConnectionStateChange(connection: BluetoothGatt,result: Int,newState: Int){handler.post{
            if(connection!==gatt||closed)return@post
            if(result!=BluetoothGatt.GATT_SUCCESS){failed("The ring disconnected. Trying again.");return@post}
            if(newState==BluetoothProfile.STATE_CONNECTED){
                handler.removeCallbacks(connectTimeout);runtime.updateConnection(LinkState.SYNCING,session);onState()
                connection.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_BALANCED)
                if(!connection.discoverServices())failed("Couldn’t read the ring’s controls.")
                else handler.postDelayed(connectTimeout,10000)
            }else if(newState==BluetoothProfile.STATE_DISCONNECTED){
                if(intentional){runtime.store.update{it.copy(backgroundWanted=false)};closeLink();runtime.updateConnection(LinkState.SLEEPING,session);onState()}
                else failed("Ring disconnected. It will reconnect when it’s awake and nearby.")
            }
        }}
        override fun onServicesDiscovered(connection: BluetoothGatt,result: Int){handler.post{
            if(connection!==gatt||closed)return@post
            if(result!=BluetoothGatt.GATT_SUCCESS){failed("Couldn’t read the ring’s controls.");return@post}
            val service=connection.getService(UUID.fromString(RingProtocol.SERVICE))
            event=service?.getCharacteristic(UUID.fromString(RingProtocol.EVENT))
            status=service?.getCharacteristic(UUID.fromString(RingProtocol.STATUS))
            val characteristic=event;val descriptor=characteristic?.getDescriptor(UUID.fromString(RingProtocol.CCCD))
            if(characteristic==null||descriptor==null||!connection.setCharacteristicNotification(characteristic,true)){
                intentional=true;failed("This device doesn’t have the SenseRing controls. Choose SmartRing.");return@post
            }
            enqueue(Operation("subscribe",{
                if(Build.VERSION.SDK_INT>=33)connection.writeDescriptor(descriptor,BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)==BluetoothStatusCodes.SUCCESS
                else {descriptor.value=BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;connection.writeDescriptor(descriptor)}
            },{ok,_->
                if(!ok)failed("Couldn’t listen to ring gestures. Reconnecting.")
                else {subscribed=true;if(confirmedMode!=null)acceptMode(confirmedMode!!) else handler.postDelayed(syncTimeout,5000);readStatus(true)}
            }))
        }}
        override fun onDescriptorWrite(connection: BluetoothGatt,descriptor: BluetoothGattDescriptor,result: Int){handler.post{if(connection===gatt)finish("subscribe",result==BluetoothGatt.GATT_SUCCESS,null)}}
        override fun onCharacteristicWrite(connection: BluetoothGatt,characteristic: BluetoothGattCharacteristic,result: Int){handler.post{if(connection===gatt)finish("write",result==BluetoothGatt.GATT_SUCCESS,null)}}
        override fun onCharacteristicRead(connection: BluetoothGatt,characteristic: BluetoothGattCharacteristic,result: Int){
            val value=characteristic.value?.clone();handler.post{if(connection===gatt)finish("read",result==BluetoothGatt.GATT_SUCCESS,value)}
        }
        override fun onCharacteristicRead(connection: BluetoothGatt,characteristic: BluetoothGattCharacteristic,value: ByteArray,result: Int){
            val bytes=value.clone();handler.post{if(connection===gatt)finish("read",result==BluetoothGatt.GATT_SUCCESS,bytes)}
        }
        override fun onCharacteristicChanged(connection: BluetoothGatt,characteristic: BluetoothGattCharacteristic){
            val received=SystemClock.elapsedRealtime()
            val bytes=characteristic.value?.clone()?:return;handler.post{if(connection===gatt&&characteristic.uuid==UUID.fromString(RingProtocol.EVENT))token(bytes,received)}
        }
        override fun onCharacteristicChanged(connection: BluetoothGatt,characteristic: BluetoothGattCharacteristic,value: ByteArray){
            val received=SystemClock.elapsedRealtime()
            val bytes=value.clone();handler.post{if(connection===gatt&&characteristic.uuid==UUID.fromString(RingProtocol.EVENT))token(bytes,received)}
        }
    }
}
