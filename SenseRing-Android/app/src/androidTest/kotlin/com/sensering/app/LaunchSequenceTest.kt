package com.sensering.app

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Color
import android.os.SystemClock
import android.provider.MediaStore
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LaunchSequenceTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Test fun rotatingRingOpensAndBrandAppearsBeforeTheDashboard(){
        rule.mainClock.autoAdvance=false
        try {
            rule.waitUntil(15000){
                // TextureView's ready callback needs a Compose frame to publish its tag.
                rule.mainClock.advanceTimeByFrame()
                rule.onAllNodesWithTag("launch-3d-ready").fetchSemanticsNodes().isNotEmpty()
            }
            rule.mainClock.advanceTimeBy(700);rule.waitForIdle();SystemClock.sleep(180)
            val rotating=capture("Launch-rotation.png")
            rule.mainClock.advanceTimeBy(1550);rule.waitForIdle();SystemClock.sleep(180)
            val opened=capture("Launch-inside.png")
            rule.mainClock.advanceTimeBy(650);rule.waitForIdle();SystemClock.sleep(180)
            capture("Launch-wordmark.png").recycle()
            // Compare rows so high-resolution captures do not require two full-size Java arrays.
            val a=IntArray(rotating.width);val b=IntArray(opened.width)
            var changed=0;var red=0
            for(y in 0 until rotating.height){
                rotating.getPixels(a,0,rotating.width,0,y,rotating.width,1)
                opened.getPixels(b,0,opened.width,0,y,opened.width,1)
                for(x in a.indices){
                    if(a[x]!=b[x])changed++
                    val color=b[x];if(Color.red(color)>80&&Color.red(color)>Color.green(color)*1.5&&Color.red(color)>Color.blue(color)*1.5)red++
                }
            }
            assertTrue("The launch ring did not animate",changed>3000)
            assertTrue("The red touch module is missing from the opening view",red>20)
            rotating.recycle();opened.recycle()
            rule.mainClock.advanceTimeBy(700);rule.waitForIdle()
            rule.onNodeWithTag("bottom-navigation").assertIsDisplayed()
            rule.onNodeWithTag("launch-sequence").assertDoesNotExist()
            rule.onNodeWithTag("ring-model-rendered").assertDoesNotExist()
            rule.waitUntil(5000){Thread.getAllStackTraces().keys.none{it.isAlive&&it.name=="SenseRing-intro"}}
        } finally {rule.mainClock.autoAdvance=true}
    }
    @Test fun skipOpensTheDashboardWithoutWaitingForTheSequence(){
        rule.dismissIntro()
        rule.onNodeWithText("Dashboard").assertIsDisplayed()
        rule.onNodeWithTag("launch-sequence").assertDoesNotExist()
    }
    @Test fun returningToTheAppDoesNotReplayTheIntro(){
        rule.dismissIntro()
        rule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        rule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        rule.onNodeWithText("Dashboard").assertIsDisplayed()
        rule.onNodeWithTag("launch-sequence").assertDoesNotExist()
    }
    private fun capture(name:String):Bitmap{
        val bitmap=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        assertNotNull(bitmap)
        val resolver=rule.activity.contentResolver
        val uri=resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,ContentValues().apply{
            put(MediaStore.Images.Media.DISPLAY_NAME,name);put(MediaStore.Images.Media.MIME_TYPE,"image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/SenseRing-v130")
        })!!
        resolver.openOutputStream(uri)!!.use{assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,it))}
        return bitmap
    }
}
