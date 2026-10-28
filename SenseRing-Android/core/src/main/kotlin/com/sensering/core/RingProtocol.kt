package com.sensering.core

enum class RingMode(val id: String, val title: String, val command: String) {
    MUSIC("media", "Music", "MODE_DEFAULT"),
    SLIDES("presentation", "Apps / slides", "MODE_PRESENTATION");
    companion object { fun fromId(value: String?) = entries.firstOrNull { it.id == value } }
}

enum class RingAction(val title: String, val isPresentation: Boolean = false) {
    PLAY_PAUSE("Play / pause"), NEXT("Next track"), PREV("Previous track"),
    VOL_UP("Volume up"), VOL_DOWN("Volume down"),
    SLIDE_NEXT("Next", true), SLIDE_PREV("Previous", true),
    SELECT("Select / tap", true), SCROLL_UP("Scroll up", true), SCROLL_DOWN("Scroll down", true)
}

data class RingInput(val id: String, val label: String, val hint: String, val token: String, val action: RingAction)
sealed interface RingMessage {
    data class ModeChanged(val mode: RingMode) : RingMessage
    data class Gesture(val mode: RingMode, val input: RingInput) : RingMessage
}

object RingProtocol {
    const val NAME = "SmartRing"
    const val SERVICE = "12345678-1234-1234-1234-123456789abc"
    const val EVENT = "abcd1234-ab12-ab12-ab12-abcdef123456"
    const val STATUS = "abcd1234-ab12-ab12-ab12-abcdef123457"
    const val CCCD = "00002902-0000-1000-8000-00805f9b34fb"
    val inputs = linkedMapOf(
        RingMode.MUSIC to listOf(
            RingInput("tap-single", "Single tap", "Touch once, then lift", "PLAY_PAUSE", RingAction.PLAY_PAUSE),
            RingInput("tap-double", "Double tap", "Two touches with a clear lift", "NEXT", RingAction.NEXT),
            RingInput("tap-triple", "Triple tap", "One deliberate tap, then two quick taps", "PREV", RingAction.PREV),
            RingInput("touch-hold", "Touch and hold", "Hold for 0.7 seconds", "VOL_UP", RingAction.VOL_UP),
            RingInput("tap-hold", "Tap then hold", "Tap, lift, then hold", "VOL_DOWN", RingAction.VOL_DOWN)
        ),
        RingMode.SLIDES to listOf(
            RingInput("slide-forward", "Single tap / hold", "Both gestures share this action", "SLIDE_NEXT", RingAction.SLIDE_NEXT),
            RingInput("slide-back", "Double tap / tap-and-hold", "Both gestures share this action", "SLIDE_PREV", RingAction.SLIDE_PREV),
            RingInput("select", "Triple tap", "Select or confirm", "SELECT", RingAction.SELECT)
        )
    )
    private val tokenIndex = inputs.flatMap { (mode, items) -> items.map { it.token to RingMessage.Gesture(mode, it) } }.toMap()
    fun decode(raw: String): RingMessage? {
        if (raw.length > 80) return null
        return when (val token = raw.trim()) {
            "MODE_DEFAULT", "MODE_MEDIA" -> RingMessage.ModeChanged(RingMode.MUSIC)
            "MODE_PRESENTATION" -> RingMessage.ModeChanged(RingMode.SLIDES)
            else -> tokenIndex[token]
        }
    }
    fun defaults(): Map<RingMode, Map<String, RingAction>> = inputs.mapValues { (_, list) -> list.associate { it.id to it.action } }
}

data class DeliveryContext(
    val session: Long, val ready: Boolean, val mode: RingMode?,
    val switchingMode: Boolean = false, val sleeping: Boolean = false
)

object DeliveryPolicy {
    const val MAX_AGE_MS = 1500L
    fun allows(context: DeliveryContext, message: RingMessage.Gesture, session: Long, receivedMs: Long, nowMs: Long): Boolean =
        context.ready && !context.sleeping && !context.switchingMode && context.session == session &&
            context.mode == message.mode && nowMs >= receivedMs && nowMs - receivedMs <= MAX_AGE_MS
}

class ReconnectBackoff {
    private var attempt = 0
    fun nextMs(): Long = longArrayOf(1000, 2000, 5000, 10000, 30000)[(attempt++).coerceAtMost(4)]
    fun reset() { attempt = 0 }
}
