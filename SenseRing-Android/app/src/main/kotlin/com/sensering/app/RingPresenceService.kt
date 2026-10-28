@file:Suppress("DEPRECATION","OVERRIDE_DEPRECATION")
package com.sensering.app

import android.companion.CompanionDeviceService
import android.companion.DevicePresenceEvent
import androidx.annotation.RequiresApi

@RequiresApi(31)
class RingPresenceService : CompanionDeviceService() {
    override fun onDeviceAppeared(address: String) {
        val config=ringRuntime.store.current
        if(config.backgroundWanted&&config.address.equals(address,true)&&!ringRuntime.current.serviceRunning)
            RingConnectionService.start(this,address)
    }
    override fun onDeviceDisappeared(address: String) {
        // The active GATT session owns disconnection and bounded retries. Presence
        // can flap independently, so it must not tear down a working connection.
    }
}

@RequiresApi(36)
class ModernRingPresenceService : CompanionDeviceService() {
    override fun onDevicePresenceEvent(event: DevicePresenceEvent) {
        val config=ringRuntime.store.current
        if(event.associationId==config.associationId&&
            (event.event==DevicePresenceEvent.EVENT_BLE_APPEARED||event.event==DevicePresenceEvent.EVENT_BT_CONNECTED)&&
            config.backgroundWanted&&config.address!=null&&!ringRuntime.current.serviceRunning)
            RingConnectionService.start(this,config.address)
    }
}
