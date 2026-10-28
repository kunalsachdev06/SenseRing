package com.sensering.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sensering.app.Appearance
import androidx.activity.compose.LocalActivity
import androidx.core.view.WindowCompat

data class GlassColors(val dark: Boolean,val page: Color,val panel: Color,val ink: Color,val muted: Color,val accent: Color,val mint: Color,val line: Color)
val LocalGlassColors=staticCompositionLocalOf { darkPalette() }
private fun darkPalette()=GlassColors(true,Color(0xFF171715),Color(0xFF242420),Color(0xFFF2F0E9),Color(0xFFB6B4AA),Color(0xFFE3A076),Color(0xFF94BA9B),Color.White.copy(alpha=.10f))
private fun lightPalette()=GlassColors(false,Color(0xFFF4F2EC),Color(0xFFFFFEFA),Color(0xFF24241F),Color(0xFF706E64),Color(0xFFA84D2B),Color(0xFF446C50),Color(0xFF666458).copy(alpha=.13f))
@Composable fun SenseRingTheme(appearance: Appearance,content: @Composable () -> Unit) {
    val dark=when(appearance){Appearance.SYSTEM->isSystemInDarkTheme();Appearance.DARK->true;Appearance.LIGHT->false}
    val colors=if(dark)darkPalette() else lightPalette()
    val activity=LocalActivity.current
    SideEffect {activity?.let {WindowCompat.getInsetsController(it.window,it.window.decorView).apply {
        isAppearanceLightStatusBars=!dark;isAppearanceLightNavigationBars=!dark
    }}}
    val scheme=if(dark)darkColorScheme(
        primary=colors.accent,onPrimary=Color(0xFF2E1D13),primaryContainer=Color(0xFF593827),onPrimaryContainer=Color(0xFFFFE4D1),
        secondary=Color(0xFFC6C1B2),onSecondary=Color(0xFF2B2A24),secondaryContainer=Color(0xFF3B3931),onSecondaryContainer=Color(0xFFECE7D6),
        tertiary=colors.mint,onTertiary=Color(0xFF1B3120),tertiaryContainer=Color(0xFF304A34),onTertiaryContainer=Color(0xFFD5EBD9),
        background=colors.page,onBackground=colors.ink,surface=colors.panel,onSurface=colors.ink,surfaceVariant=Color(0xFF30302A),onSurfaceVariant=colors.muted,
        outline=Color(0xFF807D72),outlineVariant=Color(0xFF3A3932),surfaceTint=Color.Transparent,
        inverseSurface=Color(0xFFEFEEE6),inverseOnSurface=Color(0xFF24241F),inversePrimary=Color(0xFF974325),
        surfaceDim=colors.page,surfaceBright=Color(0xFF34342E),surfaceContainerLowest=Color(0xFF121210),surfaceContainerLow=Color(0xFF1D1D19),
        surfaceContainer=colors.panel,surfaceContainerHigh=Color(0xFF2D2D27),surfaceContainerHighest=Color(0xFF35352F))
    else lightColorScheme(
        primary=colors.accent,onPrimary=Color.White,primaryContainer=Color(0xFFF8DDC9),onPrimaryContainer=Color(0xFF3A1D0F),
        secondary=Color(0xFF666253),onSecondary=Color.White,secondaryContainer=Color(0xFFE7E3D5),onSecondaryContainer=Color(0xFF25241E),
        tertiary=colors.mint,onTertiary=Color.White,tertiaryContainer=Color(0xFFD2E7D4),onTertiaryContainer=Color(0xFF17301D),
        background=colors.page,onBackground=colors.ink,surface=colors.panel,onSurface=colors.ink,surfaceVariant=Color(0xFFE8E5DB),onSurfaceVariant=colors.muted,
        outline=Color(0xFF837F73),outlineVariant=Color(0xFFD3D0C6),surfaceTint=Color.Transparent,
        inverseSurface=Color(0xFF30302A),inverseOnSurface=Color(0xFFF2F0E9),inversePrimary=Color(0xFFE3A076),
        surfaceDim=Color(0xFFDEDCD3),surfaceBright=colors.panel,surfaceContainerLowest=Color.White,surfaceContainerLow=Color(0xFFF8F6EF),
        surfaceContainer=Color(0xFFF0EEE5),surfaceContainerHigh=Color(0xFFEAE7DE),surfaceContainerHighest=Color(0xFFE2DFD5))
    CompositionLocalProvider(LocalGlassColors provides colors,LocalContentColor provides colors.ink){MaterialTheme(colorScheme=scheme,typography=Typography(
        headlineLarge=Typography().headlineLarge.copy(fontSize=32.sp,fontWeight=FontWeight.Medium,letterSpacing=(-1).sp),
        headlineMedium=Typography().headlineMedium.copy(fontSize=26.sp,fontWeight=FontWeight.Medium,letterSpacing=(-.7).sp),
        titleLarge=Typography().titleLarge.copy(fontSize=21.sp,fontWeight=FontWeight.Medium),
        bodyMedium=Typography().bodyMedium.copy(fontSize=14.sp,lineHeight=21.sp)
    ),content=content)}
}
@Composable fun AppBackground(modifier: Modifier=Modifier) {
    val colors=LocalGlassColors.current
    Canvas(modifier.background(colors.page)){
        drawRect(Brush.radialGradient(listOf(colors.ink.copy(alpha=if(colors.dark).035f else .018f),Color.Transparent),Offset(size.width*.85f,0f),size.width*1.1f))
    }
}
@Composable fun GlassCard(modifier: Modifier=Modifier,content: @Composable ColumnScope.() -> Unit) {
    val colors=LocalGlassColors.current
    val shape=RoundedCornerShape(22.dp)
    Column(modifier.clip(shape).background(colors.panel.copy(alpha=.94f),shape)
        .background(Brush.linearGradient(listOf(Color.White.copy(alpha=if(colors.dark).025f else .32f),Color.Transparent)),shape)
        .border(.8.dp,colors.line,shape),content=content)
}
