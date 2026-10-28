package com.sensering.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable fun RingModel(modifier: Modifier=Modifier,exploded: Boolean=false) {
    val context=LocalContext.current.applicationContext
    var size by remember{mutableStateOf(IntSize.Zero)}
    var yaw by remember{mutableDoubleStateOf(-.72)}
    var pitch by remember{mutableDoubleStateOf(.38)}
    var image by remember{mutableStateOf<ImageBitmap?>(null)}
    var renderedExploded by remember{mutableStateOf(false)}
    var failed by remember{mutableStateOf(false)}
    LaunchedEffect(size,exploded,yaw,pitch){
        if(size.width>0&&size.height>0){
            try {
                val next=withContext(Dispatchers.Default){NativeRingRenderer.render(context,size.width,size.height,exploded,yaw,pitch)}
                image=next.asImageBitmap();renderedExploded=exploded;failed=false
            }catch(error:CancellationException){throw error}
            catch(_:Exception){failed=true}
        }
    }
    Box(modifier.onSizeChanged{size=it}.pointerInput(Unit){
        detectDragGestures{change,amount->
            change.consume()
            yaw+=amount.x/size.width.coerceAtLeast(1)*4
            pitch=(pitch+amount.y/size.height.coerceAtLeast(1)*2).coerceIn(-1.1,1.1)
        }
    },contentAlignment=Alignment.Center){
        val bitmap=image
        if(bitmap!=null)Image(bitmap,if(renderedExploded)"SenseRing with covers open" else "SenseRing",Modifier.fillMaxSize().testTag("ring-model-rendered"))
        else if(failed)Text("SenseRing",color=LocalGlassColors.current.muted)
        else CircularProgressIndicator(color=LocalGlassColors.current.accent)
    }
}
