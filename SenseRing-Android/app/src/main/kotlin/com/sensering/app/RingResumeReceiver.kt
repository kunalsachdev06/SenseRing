package com.sensering.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.sensering.core.PhoneControlPolicy

/** Restores only the connection the user left enabled, after unlock or an update. */
class RingResumeReceiver:BroadcastReceiver() {
    override fun onReceive(context:Context,intent:Intent?) {
        if(intent?.action!=Intent.ACTION_BOOT_COMPLETED&&intent?.action!=Intent.ACTION_MY_PACKAGE_REPLACED)return
        val configuration=context.ringRuntime.store.current
        val allowed=Build.VERSION.SDK_INT<31||ContextCompat.checkSelfPermission(context,Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED
        if(PhoneControlPolicy.shouldResumeConnection(configuration.backgroundWanted,configuration.address,allowed))
            RingConnectionService.start(context,configuration.address!!)
    }
}
