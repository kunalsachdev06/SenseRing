package com.sensering.app

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.test.ext.junit.rules.ActivityScenarioRule

internal fun AndroidComposeTestRule<ActivityScenarioRule<MainActivity>,MainActivity>.dismissIntro(){
    val advance=mainClock.autoAdvance
    try {
        mainClock.autoAdvance=false
        mainClock.advanceTimeByFrame();waitForIdle()
        if(onAllNodesWithTag("skip-intro").fetchSemanticsNodes().isNotEmpty())onNodeWithTag("skip-intro").performClick()
        mainClock.advanceTimeByFrame()
    } finally {mainClock.autoAdvance=advance}
    onNodeWithTag("bottom-navigation").assertIsDisplayed()
}
