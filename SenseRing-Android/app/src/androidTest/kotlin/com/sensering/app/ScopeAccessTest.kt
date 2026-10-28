package com.sensering.app

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.setContent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.sensering.core.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ScopeAccessTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Before fun openDashboard(){rule.dismissIntro()}
    @After fun clean(){rule.runOnIdle{rule.activity.ringRuntime.store.update{AppConfiguration()}}}

    @Test fun upgradingAnExistingInstallationPreservesItsNarrowConsent() {
        val base=rule.activity.applicationContext
        val preferences=base.getSharedPreferences("scope-migration-test",Context.MODE_PRIVATE)
        val isolated=object:ContextWrapper(base){override fun getSharedPreferences(name:String,mode:Int)=preferences}
        try {
            preferences.edit().clear().commit()
            assertEquals(TouchScope.ALL_APPS,AppStore(isolated).current.touchScope)
            preferences.edit().putString("profiles",Profiles.serialize(ProfileDocument())).putString("presentationPackage","com.example.slides").commit()
            val migrated=AppStore(isolated)
            assertEquals(TouchScope.SELECTED_APP,migrated.current.touchScope)
            migrated.update{it.copy(touchScope=TouchScope.ALL_APPS)}
            assertEquals(TouchScope.ALL_APPS,AppStore(isolated).current.touchScope)
            assertEquals("com.example.slides",AppStore(isolated).current.presentationPackage)
        } finally {preferences.edit().clear().commit()}
    }
    @Test fun expandingAnAlreadyEnabledServiceNeedsAnExplicitChoice() {
        rule.runOnIdle {
            val activity=rule.activity
            activity.ringRuntime.store.update{it.copy(touchScope=TouchScope.SELECTED_APP)}
            // This fixture represents existing OS consent; it grants no actual service access.
            activity.setContent {SenseRingUi(activity.ringRuntime,AccessStatus(presentations=true),emptyList(),activity)}
        }
        rule.dismissIntro()
        rule.onNodeWithContentDescription("Settings").performClick()
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("All apps"))
        rule.onNodeWithText("All apps").performClick()
        rule.onNodeWithText("Use all apps").assertIsDisplayed()
        rule.runOnIdle{assertEquals(TouchScope.SELECTED_APP,rule.activity.ringRuntime.store.current.touchScope)}
        rule.onNodeWithText("Cancel").performClick()
        rule.runOnIdle{assertEquals(TouchScope.SELECTED_APP,rule.activity.ringRuntime.store.current.touchScope)}
        rule.onNodeWithText("All apps").performClick()
        rule.onNodeWithText("Use all apps").performClick()
        rule.runOnIdle{assertEquals(TouchScope.ALL_APPS,rule.activity.ringRuntime.store.current.touchScope)}
    }
    @Test fun theNavigationDockIsCompactAndItsTabsHaveTouchTargets() {
        val dock=rule.onNodeWithTag("bottom-navigation").getUnclippedBoundsInRoot()
        assertTrue((dock.right-dock.left).value<300f);assertTrue((dock.bottom-dock.top).value<70f)
        for(tab in listOf("Ring","Controls","Settings")){
            val bounds=rule.onNodeWithContentDescription(tab).getUnclippedBoundsInRoot()
            assertTrue("$tab has a small touch target: $bounds",(bounds.right-bounds.left).value>=48f&&(bounds.bottom-bounds.top).value>=48f)
        }
    }
}
