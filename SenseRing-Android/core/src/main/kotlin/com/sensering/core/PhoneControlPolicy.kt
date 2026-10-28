package com.sensering.core

enum class TouchScope(val title:String) { ALL_APPS("All apps"), SELECTED_APP("One chosen app") }
enum class TouchBlock { NONE, LOCKED, SCREEN_OFF, CHOOSE_APP, OPEN_CHOSEN_APP }

object PhoneControlPolicy {
    fun touchBlock(locked:Boolean,interactive:Boolean,scope:TouchScope,chosenPackage:String,foregroundPackage:String?):TouchBlock = when {
        locked -> TouchBlock.LOCKED
        !interactive -> TouchBlock.SCREEN_OFF
        scope==TouchScope.ALL_APPS -> TouchBlock.NONE
        chosenPackage.isBlank() -> TouchBlock.CHOOSE_APP
        foregroundPackage!=chosenPackage -> TouchBlock.OPEN_CHOSEN_APP
        else -> TouchBlock.NONE
    }
    fun shouldResumeConnection(wanted:Boolean,address:String?,bluetoothAllowed:Boolean):Boolean =
        wanted && bluetoothAllowed && address!=null && Regex("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}").matches(address)
}
