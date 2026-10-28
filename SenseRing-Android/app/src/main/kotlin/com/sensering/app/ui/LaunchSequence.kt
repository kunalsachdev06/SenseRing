package com.sensering.app.ui

import android.animation.ValueAnimator
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlin.math.PI

private fun ease(value:Float):Float=value.coerceIn(0f,1f).let{it*it*(3-2*it)}
internal fun introPoseAt(milliseconds:Float)=IntroPose(
    yaw=-.72f+(PI*2).toFloat()*ease(milliseconds/1900f),
    exploded=ease((milliseconds-1500f)/1050f),
    scale=.94f+.06f*ease(milliseconds/400f)
)

/** Once per Activity launch; returning from another app never replays it. */
@Composable fun LaunchSequence(onFinished:()->Unit){
    val colors=LocalGlassColors.current
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    val finish by rememberUpdatedState(onFinished)
    val motion=remember{ValueAnimator.areAnimatorsEnabled()}
    var elapsed by rememberSaveable{mutableFloatStateOf(0f)}
    var ready by remember{mutableStateOf(false)}
    val wordmark=ease((elapsed-2180f)/620f)
    val stage=when{elapsed<1500f->"Spinning";elapsed<2350f->"Inside";else->"SenseRing"}
    LaunchedEffect(ready,motion){
        if(!motion){delay(120);finish();return@LaunchedEffect}
        if(ready)lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED){
            var previous=0L
            while(elapsed<3400f){
                withFrameNanos{now->
                    if(previous!=0L)elapsed+=(now-previous).coerceAtMost(100_000_000L)/1_000_000f
                    previous=now
                }
            }
            finish()
        }
    }
    LaunchedEffect(Unit){delay(3500);if(!ready&&motion)finish()}
    Box(Modifier.fillMaxSize().background(colors.page).testTag("launch-sequence").semantics{stateDescription=stage}){
        Canvas(Modifier.fillMaxSize()){
            drawRect(Brush.radialGradient(listOf(colors.accent.copy(alpha=if(colors.dark).055f else .045f),Color.Transparent),center.copy(y=size.height*.39f),size.width*.82f))
        }
        if(motion)Box(Modifier.align(Alignment.Center).offset(y=(-55).dp).fillMaxWidth().heightIn(max=440.dp).aspectRatio(1.05f).graphicsLayer{alpha=.001f+.999f*ease(elapsed/230f)},contentAlignment=Alignment.Center){
            AndroidView(factory={context->RingIntroView(context).apply{onReady={ready=true};onFailure={finish()}}},
                modifier=Modifier.fillMaxSize().testTag(if(ready)"launch-3d-ready" else "launch-3d-loading"),
                update={it.setPose(introPoseAt(elapsed))})
        }
        Column(Modifier.align(Alignment.Center).offset(y=135.dp).graphicsLayer{
            alpha=if(motion)wordmark else 1f;translationY=(1f-wordmark)*18.dp.toPx();scaleX=.97f+.03f*wordmark;scaleY=scaleX
        },horizontalAlignment=Alignment.CenterHorizontally){
            Row(verticalAlignment=Alignment.CenterVertically){
                Text("SenseRing",fontSize=42.sp,fontWeight=FontWeight.Medium,letterSpacing=(-1.6).sp,color=colors.ink)
                Text(".",fontSize=44.sp,fontWeight=FontWeight.Medium,color=colors.accent)
            }
            Spacer(Modifier.height(9.dp));Text("Control at your fingertips.",fontSize=12.sp,letterSpacing=.5.sp,color=colors.muted)
        }
        TextButton(onClick={finish()},modifier=Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top=8.dp,end=15.dp).testTag("skip-intro")){
            Text("Skip",fontSize=12.sp,color=colors.muted)
        }
    }
}
