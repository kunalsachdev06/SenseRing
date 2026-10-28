package com.sensering.app

import android.content.Context
import androidx.core.content.edit
import com.sensering.core.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class Appearance { SYSTEM, LIGHT, DARK }
enum class SlideStyle(val title: String) { SWIPE_VERTICAL("Swipe up / down"), SWIPE("Swipe left / right"), TAP_EDGES("Tap screen edges"), ARROW_KEYS("Arrow keys") }
data class AppConfiguration(
    val profiles: ProfileDocument = ProfileDocument(), val appearance: Appearance = Appearance.SYSTEM,
    val address: String? = null, val associationId: Int = -1, val backgroundWanted: Boolean = false,
    val presentationPackage: String = "", val presentationName: String = "Choose an app",
    val slideStyle: SlideStyle = SlideStyle.SWIPE_VERTICAL,
    val touchScope: TouchScope = TouchScope.ALL_APPS
)
class AppStore(context: Context) {
    private val preferences = context.getSharedPreferences("sense-ring", Context.MODE_PRIVATE)
    private val mutable = MutableStateFlow(load())
    val configuration = mutable.asStateFlow()
    val current get() = mutable.value
    private fun load(): AppConfiguration {
        val profiles = runCatching { preferences.getString("profiles", null)?.let(Profiles::restore) }.getOrNull() ?: ProfileDocument()
        val savedStyle=runCatching { SlideStyle.valueOf(preferences.getString("slideStyle",null)!!) }.getOrDefault(SlideStyle.SWIPE_VERTICAL)
        // Adopt the requested vertical default once; preserve later explicit horizontal choices.
        val style=if(preferences.getInt("slideStyleVersion",0)<2&&savedStyle==SlideStyle.SWIPE)SlideStyle.SWIPE_VERTICAL else savedStyle
        return AppConfiguration(
            profiles = profiles,
            appearance = runCatching { Appearance.valueOf(preferences.getString("appearance", "SYSTEM")!!) }.getOrDefault(Appearance.SYSTEM),
            address = preferences.getString("address", null), associationId = preferences.getInt("association", -1),
            backgroundWanted = preferences.getBoolean("backgroundWanted", false),
            presentationPackage = preferences.getString("presentationPackage", "").orEmpty(),
            presentationName = preferences.getString("presentationName", "Choose an app").orEmpty(),
            slideStyle = style,
            // An update preserves the narrower scope covered by the old consent.
            touchScope = runCatching { TouchScope.valueOf(preferences.getString("touchScope",null)!!) }
                .getOrDefault(if(preferences.contains("profiles"))TouchScope.SELECTED_APP else TouchScope.ALL_APPS)
        )
    }
    @Synchronized fun update(block: (AppConfiguration) -> AppConfiguration) {
        val next = block(current)
        preferences.edit {putString("profiles", Profiles.serialize(next.profiles))
            .putString("appearance", next.appearance.name).putString("address", next.address)
            .putInt("association", next.associationId).putBoolean("backgroundWanted", next.backgroundWanted)
            .putString("presentationPackage", next.presentationPackage).putString("presentationName", next.presentationName)
            .putString("slideStyle", next.slideStyle.name).putInt("slideStyleVersion",2).putString("touchScope",next.touchScope.name)}
        mutable.value = next
    }
}
