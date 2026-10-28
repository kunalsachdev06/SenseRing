package com.sensering.core

import org.junit.Assert.*
import org.junit.Test

class CoreTest {
    @Test fun everyFirmwareGestureHasAnUnambiguousModeAndDefaultAction() {
        assertEquals(8, RingProtocol.inputs.values.sumOf { it.size })
        RingProtocol.inputs.forEach { (mode, inputs) -> inputs.forEach { input ->
            val event = RingProtocol.decode(input.token) as RingMessage.Gesture
            assertEquals(mode, event.mode); assertEquals(input.action, defaultProfile().action(mode, event.input))
        } }
    }
    @Test fun delayedPresentationTokensKeepPresentationIdentity() {
        assertEquals(RingMode.SLIDES, (RingProtocol.decode("SLIDE_NEXT") as RingMessage.Gesture).mode)
        assertEquals(RingMode.MUSIC, (RingProtocol.decode("NEXT") as RingMessage.Gesture).mode)
    }
    @Test fun onlyExplicitModeTokensAreModeChanges() {
        assertEquals(RingMessage.ModeChanged(RingMode.MUSIC), RingProtocol.decode("MODE_DEFAULT"))
        assertEquals(RingMessage.ModeChanged(RingMode.MUSIC), RingProtocol.decode("MODE_MEDIA"))
        assertEquals(RingMessage.ModeChanged(RingMode.SLIDES), RingProtocol.decode("MODE_PRESENTATION"))
    }
    @Test fun malformedOrUnknownNotificationsDoNotProduceActions() {
        listOf("", "SLEEP", "STATUS", "next", "VOL_UP;SLEEP", "x".repeat(81)).forEach { assertNull(RingProtocol.decode(it)) }
    }
    @Test fun profileRemapsHappenOnThePhoneAndDoNotChangeFirmwareIdentity() {
        val doc = Profiles.remap(ProfileDocument(), RingMode.MUSIC, "tap-single", RingAction.NEXT)
        assertEquals(RingAction.NEXT, doc.active().action(RingMode.MUSIC, RingProtocol.inputs.getValue(RingMode.MUSIC).first()))
        assertEquals("PLAY_PAUSE", RingProtocol.inputs.getValue(RingMode.MUSIC).first().token)
    }
    @Test fun websiteFormatImportsAndExportsWithoutChangingGroupedSlideInputs() {
        val original = Profiles.remap(ProfileDocument(), RingMode.SLIDES, "slide-forward", RingAction.VOL_UP).active()
        val encoded = Profiles.export(original)
        assertTrue(encoded.contains("\"format\": \"sensering-profile\""))
        assertEquals(original.mappings, Profiles.parseImport(encoded).mappings)
        assertEquals(3, Profiles.parseImport(encoded).mappings.getValue(RingMode.SLIDES).size)
    }
    @Test fun saveSwitchRestoreAndDeleteKeepDefaultProfile() {
        val saved = Profiles.create(ProfileDocument(), "Lecture")
        assertEquals("Lecture", Profiles.restore(Profiles.serialize(saved)).active().name)
        assertEquals("Everyday", Profiles.select(saved, "default").active().name)
        val removed = Profiles.removeActive(saved)
        assertEquals("default", removed.activeId); assertEquals(1, removed.profiles.size)
    }
    @Test fun defaultCannotBeDeleted() = expectFailure { Profiles.removeActive(ProfileDocument()) }
    @Test fun profileNamesRejectAmbiguousOrUnsafeValues() {
        listOf("", " ", "a".repeat(33), "<x>", "a\n").forEach { value ->
            // A trailing newline is trimmed just like the website; an internal control is rejected.
            if(value != "a\n") expectFailure { Profiles.create(ProfileDocument(), value) }
        }
        expectFailure { Profiles.create(ProfileDocument(), "a\nb") }
    }
    @Test fun duplicateNamesAreCaseInsensitiveAndImportNamesAreMadeUnique() {
        expectFailure { Profiles.create(ProfileDocument(), "EVERYDAY") }
        assertEquals("Everyday 2", Profiles.import(ProfileDocument(), Profiles.export(defaultProfile())).active().name)
    }
    @Test fun unknownActionsAndNonStringActionsAreRejectedAtomically() {
        val raw = Profiles.export(defaultProfile())
        for (replacement in listOf("\"SHELL\"", "12", "[\"PLAY_PAUSE\"]", "null")) {
            expectFailure { Profiles.parseImport(raw.replaceFirst("\"PLAY_PAUSE\"", replacement)) }
        }
        assertEquals(RingAction.PLAY_PAUSE, defaultProfile().mappings.getValue(RingMode.MUSIC)["tap-single"])
    }
    @Test fun missingGesturesAndUnknownModesAreRejected() {
        val raw = Profiles.export(defaultProfile())
        expectFailure { Profiles.parseImport(raw.replace("\"tap-single\"", "\"unknown\"")) }
        expectFailure { Profiles.parseImport(raw.replace("\"media\"", "\"other\"")) }
    }
    @Test fun unsupportedVersionsAndOversizedFilesAreRejected() {
        expectFailure { Profiles.parseImport(Profiles.export(defaultProfile()).replace("\"version\": 1", "\"version\": 2")) }
        expectFailure { Profiles.parseImport("x".repeat(65537)) }
    }
    @Test fun corruptSavedDataDoesNotBecomeAValidDocument() {
        expectFailure { Profiles.restore("{}") }
        expectFailure { Profiles.restore(Profiles.serialize(ProfileDocument()).replace("\"default\"", "\"missing\"")) }
    }
    @Test fun profileLimitAndResetAreEnforced() {
        var doc = ProfileDocument()
        repeat(15) { doc = Profiles.create(doc, "Profile $it") }
        expectFailure { Profiles.create(doc, "One too many") }
        val changed = Profiles.remap(doc, RingMode.MUSIC, "tap-single", RingAction.PREV)
        assertEquals(RingProtocol.defaults(), Profiles.reset(changed).active().mappings)
    }
    @Test fun actionsRequireTheCurrentReadySessionAndMatchingMode() {
        val event = RingProtocol.decode("NEXT") as RingMessage.Gesture
        val good = DeliveryContext(2, true, RingMode.MUSIC)
        assertTrue(DeliveryPolicy.allows(good, event, 2, 1000, 1001))
        for(bad in listOf(good.copy(ready=false),good.copy(mode=RingMode.SLIDES),good.copy(switchingMode=true),good.copy(sleeping=true),good.copy(session=3))) {
            assertFalse(DeliveryPolicy.allows(bad,event,2,1000,1001))
        }
    }
    @Test fun staleAndImpossibleTimestampedActionsAreNeverReplayed() {
        val event = RingProtocol.decode("VOL_UP") as RingMessage.Gesture
        val context = DeliveryContext(1,true,RingMode.MUSIC)
        assertFalse(DeliveryPolicy.allows(context,event,1,1000,999))
        assertFalse(DeliveryPolicy.allows(context,event,1,1000,2501))
        assertTrue(DeliveryPolicy.allows(context,event,1,1000,2500))
    }
    @Test fun reconnectBackoffIsBoundedAndResetsAfterSuccess() {
        val retry=ReconnectBackoff()
        assertEquals(listOf(1000L,2000L,5000L,10000L,30000L,30000L),List(6){retry.nextMs()})
        retry.reset();assertEquals(1000L,retry.nextMs())
    }
    private fun expectFailure(block: () -> Any?) {
        try { block(); fail("Expected invalid input to be rejected") } catch(expected: IllegalArgumentException) { } catch(expected: IllegalStateException) { }
    }
}
