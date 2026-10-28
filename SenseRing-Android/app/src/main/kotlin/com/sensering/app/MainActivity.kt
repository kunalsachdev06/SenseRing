@file:Suppress("DEPRECATION","OVERRIDE_DEPRECATION")
package com.sensering.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationManager
import android.bluetooth.*
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.companion.*
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.accessibilityservice.AccessibilityServiceInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.core.net.toUri
import androidx.lifecycle.lifecycleScope
import com.sensering.core.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.regex.Pattern

data class AccessStatus(val bluetooth: Boolean=false,val notifications: Boolean=false,val presentations: Boolean=false)
data class PresentationApp(val packageName: String,val label: String)
interface ScreenActions {
    fun connectRing()
    fun disconnectRing()
    fun enablePresentation()
    fun choosePresentation(app: PresentationApp)
    fun setAppearance(value: Appearance)
    fun setSlideStyle(value: SlideStyle)
    fun setTouchScope(value: TouchScope)
    fun changeProfiles(transform: (ProfileDocument) -> ProfileDocument)
    fun importProfile()
    fun exportProfile()
    fun openAppSettings()
    fun allowNotifications()
    fun forgetRing()
}

class MainActivity : ComponentActivity(),ScreenActions {
    private val runtime get()=ringRuntime
    private var access by mutableStateOf(AccessStatus())
    private var installedApps by mutableStateOf<List<PresentationApp>>(emptyList())
    private var pendingConnect=false
    private var exportText=""
    private val bluetooth get()=getSystemService(BluetoothManager::class.java)?.adapter
    private val permissions=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        refreshAccess()
        if(pendingConnect){pendingConnect=false;if(access.bluetooth)continueConnect() else runtime.notice("Allow Nearby devices to connect the ring.")}
    }
    private val enableBluetooth=registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if(bluetooth?.isEnabled==true)continueConnect() else runtime.notice("Turn on Bluetooth to connect your ring.")
    }
    private val associationPicker=registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()){result ->
        if(result.resultCode!=Activity.RESULT_OK)return@registerForActivityResult
        val parcel=result.data?.let { IntentCompat.getParcelableExtra(it,CompanionDeviceManager.EXTRA_DEVICE,Parcelable::class.java) }
        val device=when(parcel){is ScanResult->parcel.device;is BluetoothDevice->parcel;else->null}
        if(device!=null)saveAndConnect(device.address,-1)
    }
    private val importDocument=registerForActivityResult(ActivityResultContracts.OpenDocument()){uri ->
        if(uri!=null)lifecycleScope.launch {
            try {
                val text=withContext(Dispatchers.IO){
                    contentResolver.openInputStream(uri)?.use { input ->
                        val out=ByteArrayOutputStream();val buffer=ByteArray(4096)
                        while(true){val read=input.read(buffer,0,minOf(buffer.size,Profiles.MAX_BYTES+1-out.size()));if(read<0)break;out.write(buffer,0,read);require(out.size()<=Profiles.MAX_BYTES)}
                        out.toString("UTF-8")
                    } ?: error("No file")
                }
                val next=Profiles.import(runtime.store.current.profiles,text)
                runtime.invalidateActions();runtime.store.update{it.copy(profiles=next)};runtime.notice("Profile imported.")
            }catch(_:Exception){runtime.notice("Choose a valid SenseRing profile smaller than 64 KB.")}
        }
    }
    private val exportDocument=registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")){uri ->
        if(uri!=null)lifecycleScope.launch {
            val text=exportText
            val saved=withContext(Dispatchers.IO){runCatching{contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) }?:error("No file")}.isSuccess}
            runtime.notice(if(saved)"Profile saved." else "Couldn’t save this profile.")
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState);enableEdgeToEdge();refreshAccess()
        lifecycleScope.launch {
            installedApps=withContext(Dispatchers.IO){
                packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0)
                    .filter { it.activityInfo.packageName!=packageName && it.activityInfo.packageName!="com.android.settings" }
                    .map { PresentationApp(it.activityInfo.packageName,it.loadLabel(packageManager).toString().take(80)) }
                    .distinctBy { it.packageName }.sortedBy { it.label.lowercase() }
            }
        }
        setContent { SenseRingUi(runtime,access,installedApps,this) }
    }
    override fun onResume() {
        super.onResume();refreshAccess()
        val config=runtime.store.current
        if(config.backgroundWanted&&config.address!=null&&access.bluetooth&&!runtime.current.serviceRunning)RingConnectionService.start(this,config.address)
    }
    private fun refreshAccess() {
        val enabled=getSystemService(AccessibilityManager::class.java).getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        access=AccessStatus(
            Build.VERSION.SDK_INT<31||ContextCompat.checkSelfPermission(this,Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED,
            getSystemService(NotificationManager::class.java).areNotificationsEnabled(),
            enabled.any { it.resolveInfo.serviceInfo.packageName==packageName&&it.resolveInfo.serviceInfo.name==RingAccessibilityService::class.java.name }
        )
    }
    override fun connectRing() {
        if(bluetooth==null){runtime.notice("This phone doesn’t support the ring’s Bluetooth connection.");return}
        val required=buildList {
            if(Build.VERSION.SDK_INT>=31&&!access.bluetooth)add(Manifest.permission.BLUETOOTH_CONNECT)
            if(Build.VERSION.SDK_INT>=33&&!access.notifications)add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if(required.isNotEmpty()){pendingConnect=true;permissions.launch(required.toTypedArray())} else continueConnect()
    }
    @SuppressLint("MissingPermission") private fun continueConnect() {
        if(bluetooth?.isEnabled!=true){enableBluetooth.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));return}
        val address=runtime.store.current.address
        if(address!=null){RingConnectionService.start(this,address);return}
        val manager=getSystemService(CompanionDeviceManager::class.java)
        if(manager==null||!packageManager.hasSystemFeature(PackageManager.FEATURE_COMPANION_DEVICE_SETUP)){
            runtime.notice("This phone’s ring picker is unavailable. Check that its system software is up to date.");return
        }
        val filter=BluetoothLeDeviceFilter.Builder().setNamePattern(Pattern.compile("(?i)(SmartRing|SenseRing).*"))
            .setScanFilter(ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(RingProtocol.SERVICE)).build()).build()
        val request=AssociationRequest.Builder().addDeviceFilter(filter).setSingleDevice(false).build()
        val callback=if(Build.VERSION.SDK_INT>=33)modernAssociationCallback() else object:CompanionDeviceManager.Callback(){
            override fun onDeviceFound(chooserLauncher: IntentSender){showAssociationPicker(chooserLauncher)}
            override fun onFailure(error: CharSequence?){associationFailed()}
        }
        try {
            if(Build.VERSION.SDK_INT>=33)manager.associate(request,mainExecutor,callback)
            else manager.associate(request,callback,Handler(mainLooper))
        }catch(_:RuntimeException){runtime.notice("Couldn’t open the ring picker. Check Bluetooth and try again.")}
    }
    @androidx.annotation.RequiresApi(33)
    private fun modernAssociationCallback()=object:CompanionDeviceManager.Callback(){
            override fun onAssociationPending(intentSender: IntentSender){showAssociationPicker(intentSender)}
            override fun onAssociationCreated(associationInfo: AssociationInfo){
                val selected=associationInfo.deviceMacAddress?.toString()
                if(selected!=null)saveAndConnect(selected,associationInfo.id)
                else runtime.notice("Couldn’t read the selected ring. Please try again.")
            }
            override fun onFailure(error: CharSequence?){associationFailed()}
    }
    private fun associationFailed(){runOnUiThread{runtime.notice("Keep your ring awake and disconnect it from your laptop, then try again. On Android 10 or 11, turn on Location Services for the initial search.")}}
    private fun showAssociationPicker(sender: IntentSender){runOnUiThread{associationPicker.launch(IntentSenderRequest.Builder(sender).build())}}
    private fun saveAndConnect(address: String,associationId: Int){runOnUiThread{
        val old=runtime.store.current
        runtime.store.update{it.copy(address=address,associationId=if(associationId>=0)associationId else old.associationId)}
        observePresence(address,associationId)
        if(runtime.current.connection!=LinkState.READY&&runtime.current.connection!=LinkState.CONNECTING&&runtime.current.connection!=LinkState.SYNCING)RingConnectionService.start(this,address)
    }}
    @SuppressLint("MissingPermission") private fun observePresence(address: String,associationId: Int) {
        if(Build.VERSION.SDK_INT<31)return
        runCatching {
            val manager=getSystemService(CompanionDeviceManager::class.java)
            if(Build.VERSION.SDK_INT>=36&&associationId>=0)manager.startObservingDevicePresence(ObservingDevicePresenceRequest.Builder().setAssociationId(associationId).build())
            else manager.startObservingDevicePresence(address)
        }
    }
    override fun disconnectRing(){RingConnectionService.disconnect(this)}
    override fun enablePresentation(){startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))}
    override fun choosePresentation(app: PresentationApp){runtime.invalidateActions();runtime.store.update{it.copy(presentationPackage=app.packageName,presentationName=app.label)}}
    override fun setAppearance(value: Appearance){runtime.store.update{it.copy(appearance=value)}}
    override fun setSlideStyle(value: SlideStyle){runtime.invalidateActions();runtime.store.update{it.copy(slideStyle=value)}}
    override fun setTouchScope(value: TouchScope){runtime.invalidateActions();runtime.store.update{it.copy(touchScope=value)}}
    override fun changeProfiles(transform: (ProfileDocument) -> ProfileDocument){
        try{runtime.invalidateActions();runtime.store.update{it.copy(profiles=transform(it.profiles))}}
        catch(error: IllegalArgumentException){runtime.notice(error.message?:"Couldn’t update this profile.")}
        catch(_:IllegalStateException){runtime.notice("Couldn’t update this profile.")}
    }
    override fun importProfile(){importDocument.launch(arrayOf("application/json","text/plain","application/octet-stream"))}
    override fun exportProfile(){
        val profile=runtime.store.current.profiles.active();exportText=Profiles.export(profile)
        exportDocument.launch("SenseRing-${profile.name.replace(Regex("[^a-zA-Z0-9_-]"),"-")}.json")
    }
    override fun openAppSettings(){startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,"package:$packageName".toUri()))}
    override fun allowNotifications(){
        if(Build.VERSION.SDK_INT>=33&&!access.notifications)permissions.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        else startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,packageName))
    }
    override fun forgetRing(){
        val config=runtime.store.current;disconnectRing()
        runCatching {
            val manager=getSystemService(CompanionDeviceManager::class.java)
            if(Build.VERSION.SDK_INT>=33&&config.associationId>=0)manager.disassociate(config.associationId)
            else config.address?.let { manager.disassociate(it) }
        }
        runtime.store.update{it.copy(address=null,associationId=-1,backgroundWanted=false)}
        runtime.notice("Ring removed. You can connect it again anytime.")
    }
}
