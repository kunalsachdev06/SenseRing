package com.sensering.app

import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.sensering.core.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GestureStyleTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Before fun openDashboard(){rule.dismissIntro()}
    @After fun reset(){rule.runOnIdle{rule.activity.ringRuntime.store.update{AppConfiguration()}}}

    @Test fun verticalDefaultAppliesToFreshAndPreviousHorizontalInstallations()=isolated{context,preferences->
        assertEquals(SlideStyle.SWIPE_VERTICAL,AppConfiguration().slideStyle)
        assertEquals(SlideStyle.SWIPE_VERTICAL,AppStore(context).current.slideStyle)
        val profiles=ProfileDocument()
        preferences.edit().putString("slideStyle","SWIPE").putString("profiles",Profiles.serialize(profiles))
            .putString("presentationPackage","com.example.slides").commit()
        val upgraded=AppStore(context)
        assertEquals(SlideStyle.SWIPE_VERTICAL,upgraded.current.slideStyle)
        assertEquals(profiles,upgraded.current.profiles)
        assertEquals("com.example.slides",upgraded.current.presentationPackage)
        upgraded.update{it.copy(slideStyle=SlideStyle.SWIPE)}
        assertEquals(SlideStyle.SWIPE,AppStore(context).current.slideStyle)
    }
    @Test fun explicitAlternativeStylesSurviveAndInvalidStylesUseTheDefault()=isolated{context,preferences->
        for(style in listOf(SlideStyle.TAP_EDGES,SlideStyle.ARROW_KEYS)){
            preferences.edit().clear().putString("slideStyle",style.name).commit()
            assertEquals(style,AppStore(context).current.slideStyle)
        }
        preferences.edit().clear().putString("slideStyle","invalid").commit()
        assertEquals(SlideStyle.SWIPE_VERTICAL,AppStore(context).current.slideStyle)
    }
    @Test fun settingsOfferBothSwipeAxesAndRememberTheSelection(){
        rule.onNodeWithContentDescription("Settings").performClick()
        rule.onNodeWithText("Swipe up / down").performScrollTo().assertIsDisplayed()
        rule.runOnIdle{assertEquals(SlideStyle.SWIPE_VERTICAL,rule.activity.ringRuntime.store.current.slideStyle)}
        rule.onNodeWithText("Swipe left / right").performScrollTo().performClick()
        rule.runOnIdle{assertEquals(SlideStyle.SWIPE,AppStore(rule.activity.applicationContext).current.slideStyle)}
        rule.onNodeWithText("Swipe up / down").performScrollTo().performClick()
        rule.runOnIdle{assertEquals(SlideStyle.SWIPE_VERTICAL,AppStore(rule.activity.applicationContext).current.slideStyle)}
        rule.onNodeWithText("Next swipes up. Previous swipes down.").performScrollTo().assertIsDisplayed()
    }
    @Test fun verticalNextAndPreviousCreateActualUpAndDownAndroidPaths(){
        endpoints(presentationStroke(RingAction.SLIDE_NEXT,SlideStyle.SWIPE_VERTICAL,1000f,2000f),500f,1600f,500f,400f)
        endpoints(presentationStroke(RingAction.SLIDE_PREV,SlideStyle.SWIPE_VERTICAL,1000f,2000f),500f,400f,500f,1600f)
    }
    @Test fun horizontalTapsAndExplicitScrollActionsKeepTheirDirections(){
        endpoints(presentationStroke(RingAction.SLIDE_NEXT,SlideStyle.SWIPE,1000f,2000f),800f,1000f,200f,1000f)
        endpoints(presentationStroke(RingAction.SLIDE_PREV,SlideStyle.SWIPE,1000f,2000f),200f,1000f,800f,1000f)
        val tap=presentationStroke(RingAction.SELECT,SlideStyle.SWIPE_VERTICAL,1000f,2000f)
        endpoints(tap,500f,1000f,500f,1000f);assertEquals(60L,tap.duration)
        endpoints(presentationStroke(RingAction.SCROLL_DOWN,SlideStyle.SWIPE_VERTICAL,1000f,2000f),500f,1440f,500f,600f)
        endpoints(presentationStroke(RingAction.SCROLL_UP,SlideStyle.SWIPE_VERTICAL,1000f,2000f),500f,600f,500f,1440f)
    }
    private fun endpoints(stroke:GestureDescription.StrokeDescription,x0:Float,y0:Float,x1:Float,y1:Float){
        val points=stroke.path.approximate(.1f);assertTrue(points.size>=6)
        assertEquals(x0,points[1],.01f);assertEquals(y0,points[2],.01f)
        assertEquals(x1,points[points.size-2],.01f);assertEquals(y1,points.last(),.01f)
    }
    private fun isolated(block:(Context,SharedPreferences)->Unit){
        val base=rule.activity.applicationContext
        val preferences=base.getSharedPreferences("gesture-style-test",Context.MODE_PRIVATE)
        val context=object:ContextWrapper(base){override fun getSharedPreferences(name:String,mode:Int)=preferences}
        try{preferences.edit().clear().commit();block(context,preferences)}finally{preferences.edit().clear().commit()}
    }
}
