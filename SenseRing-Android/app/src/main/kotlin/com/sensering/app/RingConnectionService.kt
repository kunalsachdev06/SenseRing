package com.sensering.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.bluetooth.BluetoothAdapter
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class RingConnectionService : Service() {
    companion object {
        private const val CHANNEL="ring_connection"
        private const val NOTIFICATION=41
        const val DISCONNECT="com.sensering.app.DISCONNECT"
        fun start(context: Context,address: String) {
            context.ringRuntime.store.update{it.copy(address=address,backgroundWanted=true)}
            try{ContextCompat.startForegroundService(context,Intent(context,RingConnectionService::class.java))}
            catch(_:RuntimeException){context.ringRuntime.notice("Open SenseRing and tap Connect to start the background connection.")}
        }
        fun disconnect(context: Context) {
            context.ringRuntime.store.update{it.copy(backgroundWanted=false)}
            context.ringRuntime.invalidateActions()
            context.stopService(Intent(context,RingConnectionService::class.java))
        }
    }
    private val runtime get()=ringRuntime
    private var client: RingBleClient?=null
    private val main=Handler(Looper.getMainLooper())
    private val bluetoothReceiver=object:BroadcastReceiver(){
        override fun onReceive(context: Context?,intent: Intent?){
            if(intent?.action==BluetoothAdapter.ACTION_STATE_CHANGED)client?.bluetoothChanged(intent.getIntExtra(BluetoothAdapter.EXTRA_STATE,BluetoothAdapter.STATE_OFF)==BluetoothAdapter.STATE_ON)
        }
    }
    private var receiverRegistered=false
    override fun onCreate() {
        super.onCreate()
        val notifications=getSystemService(NotificationManager::class.java)
        notifications.createNotificationChannel(NotificationChannel(CHANNEL,"Ring connection",NotificationManager.IMPORTANCE_LOW).apply {
            description="Keeps your ring controls available while you use other apps."
            setShowBadge(false)
        })
        if(Build.VERSION.SDK_INT>=31&&ContextCompat.checkSelfPermission(this,Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){stopSelf();return}
        try {
            startForeground(NOTIFICATION,notification(),ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
            client=RingBleClient(applicationContext,runtime){main.post{refreshNotification()}}
            runtime.client=client
            ContextCompat.registerReceiver(this,bluetoothReceiver,IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),ContextCompat.RECEIVER_EXPORTED)
            receiverRegistered=true
            runtime.serviceRunning(true)
        }catch(_:RuntimeException){runtime.notice("Allow Nearby devices, then connect your ring again.");stopSelf()}
    }
    override fun onStartCommand(intent: Intent?,flags: Int,startId: Int): Int {
        if(intent?.action==DISCONNECT){runtime.store.update{it.copy(backgroundWanted=false)};stopSelf();return START_NOT_STICKY}
        val config=runtime.store.current
        if(!config.backgroundWanted||config.address==null||client==null){stopSelf();return START_NOT_STICKY}
        if(runtime.current.connection!=LinkState.READY&&runtime.current.connection!=LinkState.CONNECTING&&runtime.current.connection!=LinkState.SYNCING)client?.connect(config.address)
        return START_STICKY
    }
    private fun notification(): Notification {
        val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop=PendingIntent.getService(this,1,Intent(this,RingConnectionService::class.java).setAction(DISCONNECT),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val state=runtime.current
        val detail=when(state.connection){
            LinkState.READY->"${state.mode?.title ?: "Ring"} controls ready"
            LinkState.BLUETOOTH_OFF->"Turn on Bluetooth to reconnect"
            LinkState.RECONNECTING->"Waiting for your ring nearby"
            LinkState.SLEEPING->"Ring asleep"
            else->"Connecting to your ring"
        }
        return NotificationCompat.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_ring_notification)
            .setContentTitle("SenseRing · ${state.connection.title}").setContentText(detail)
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE).addAction(0,"Disconnect",stop).build()
    }
    @SuppressLint("MissingPermission") private fun refreshNotification() {
        if(runtime.current.connection==LinkState.SLEEPING&&!runtime.store.current.backgroundWanted){stopSelf();return}
        if(runtime.current.serviceRunning)getSystemService(NotificationManager::class.java).notify(NOTIFICATION,notification())
    }
    override fun onDestroy() {
        if(receiverRegistered)unregisterReceiver(bluetoothReceiver)
        runtime.invalidateActions();runtime.client=null;client?.close();client=null
        runtime.updateConnection(if(runtime.current.connection==LinkState.SLEEPING)LinkState.SLEEPING else LinkState.DISCONNECTED,runtime.current.session)
        runtime.serviceRunning(false);stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder?=null
}
