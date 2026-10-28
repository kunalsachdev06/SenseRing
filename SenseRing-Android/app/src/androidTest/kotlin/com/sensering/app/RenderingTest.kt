package com.sensering.app

import android.graphics.Bitmap
import android.graphics.Color
import android.content.ContentValues
import android.provider.MediaStore
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.sensering.app.ui.NativeRingRenderer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RenderingTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Before fun openDashboard(){rule.dismissIntro()}
    @After fun reset(){rule.runOnIdle{rule.activity.ringRuntime.store.update{AppConfiguration()}}}

    @Test fun dashboardIsCompactAndBothNativeThemesRender() {
        rule.runOnIdle { rule.activity.ringRuntime.store.update{it.copy(appearance=Appearance.DARK)} }
        rule.onNodeWithText("Dashboard").assertIsDisplayed()
        rule.onNodeWithTag("ring-model-rendered").assertDoesNotExist()
        rule.onNodeWithText("Look inside").assertDoesNotExist()
        capture("Dashboard-dark.png")
        rule.onNodeWithContentDescription("Controls").performClick()
        rule.onNodeWithText("Your controls").assertIsDisplayed()
        capture("Controls-dark.png")
        rule.onNodeWithContentDescription("Settings").performClick()
        rule.onNodeWithText("Your connection").assertIsDisplayed()
        capture("Settings-dark.png")
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("All apps"))
        capture("App-controls-dark.png")
        rule.onNodeWithText("Swipe up / down").performScrollTo()
        capture("Presentation-style-dark.png")
        rule.runOnIdle { rule.activity.ringRuntime.store.update{it.copy(appearance=Appearance.LIGHT)} }
        rule.onNodeWithContentDescription("Ring").performClick()
        rule.onNodeWithText("Dashboard").assertIsDisplayed()
        capture("Dashboard-light.png")
    }
    @Test fun cadRasterContainsGeometryAndRedTouchModule() {
        val bitmap=runBlocking { withContext(Dispatchers.Default){NativeRingRenderer.render(rule.activity.applicationContext,600,350,false)} }
        try {
            val pixels=IntArray(bitmap.width*bitmap.height)
            bitmap.getPixels(pixels,0,bitmap.width,0,0,bitmap.width,bitmap.height)
            assertTrue("The CAD geometry was blank",pixels.count{Color.alpha(it)>100}>2000)
            assertTrue("The red touch module was not rendered",pixels.count{Color.alpha(it)>100&&Color.red(it)>80&&Color.red(it)>Color.green(it)*1.5&&Color.red(it)>Color.blue(it)*1.5}>10)
        } finally {bitmap.recycle()}
    }
    private fun capture(name:String) {
        rule.waitForIdle()
        val bitmap=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        assertNotNull("Android did not provide the render capture",bitmap)
        val resolver=rule.activity.contentResolver
        val uri=resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,ContentValues().apply{
            put(MediaStore.Images.Media.DISPLAY_NAME,name)
            put(MediaStore.Images.Media.MIME_TYPE,"image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/SenseRing-v130")
        })!!
        resolver.openOutputStream(uri)!!.use{assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,it))}
        bitmap.recycle()
    }
}
