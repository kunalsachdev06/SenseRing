package com.sensering.core

import org.junit.Assert.*
import org.junit.Test

class PhoneControlPolicyTest {
    @Test fun allAppsAllowsAnAwakeUnlockedScreenAcrossAppTypes() {
        for(app in listOf("com.spotify.music","com.google.android.youtube","com.android.launcher3","com.android.settings","com.microsoft.office.powerpoint",null))
            assertEquals(TouchBlock.NONE,PhoneControlPolicy.touchBlock(false,true,TouchScope.ALL_APPS,"",app))
    }
    @Test fun selectedAppScopeCannotLeakIntoOtherApps() {
        assertEquals(TouchBlock.NONE,PhoneControlPolicy.touchBlock(false,true,TouchScope.SELECTED_APP,"com.slides","com.slides"))
        for(app in listOf("com.slides.other","com.android.settings",null))
            assertEquals(TouchBlock.OPEN_CHOSEN_APP,PhoneControlPolicy.touchBlock(false,true,TouchScope.SELECTED_APP,"com.slides",app))
    }
    @Test fun aSecureLockBlocksTouchInEitherScope() {
        TouchScope.entries.forEach{assertEquals(TouchBlock.LOCKED,PhoneControlPolicy.touchBlock(true,true,it,"com.slides","com.slides"))}
    }
    @Test fun aScreenThatIsOffCannotReceiveInvisibleTapsEvenBeforeItLocks() {
        TouchScope.entries.forEach{assertEquals(TouchBlock.SCREEN_OFF,PhoneControlPolicy.touchBlock(false,false,it,"com.slides","com.slides"))}
    }
    @Test fun selectedAppNeedsAnExplicitTarget() {
        assertEquals(TouchBlock.CHOOSE_APP,PhoneControlPolicy.touchBlock(false,true,TouchScope.SELECTED_APP,"",null))
    }
    @Test fun bootOrAnUpdateCannotUndoAnIntentionalDisconnect() {
        assertFalse(PhoneControlPolicy.shouldResumeConnection(false,"80:F1:B2:60:5F:B0",true))
    }
    @Test fun resumingNeedsAnExistingDeviceAndBluetoothPermission() {
        for(address in listOf(null,"","SmartRing","80:F1:B2:60:5F","xx:xx:xx:xx:xx:xx"))
            assertFalse(PhoneControlPolicy.shouldResumeConnection(true,address,true))
        assertFalse(PhoneControlPolicy.shouldResumeConnection(true,"80:F1:B2:60:5F:B0",false))
    }
    @Test fun aPreviouslyEnabledConnectionCanResumeWithItsSavedAddress() {
        assertTrue(PhoneControlPolicy.shouldResumeConnection(true,"80:F1:B2:60:5F:B0",true))
        assertTrue(PhoneControlPolicy.shouldResumeConnection(true,"80:f1:b2:60:5f:b0",true))
    }
}
