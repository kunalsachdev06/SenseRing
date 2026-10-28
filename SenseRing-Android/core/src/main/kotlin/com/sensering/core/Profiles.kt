package com.sensering.core

import kotlinx.serialization.json.*
import java.util.UUID

data class ControlProfile(val id: String, val name: String, val mappings: Map<RingMode, Map<String, RingAction>>) {
    fun action(mode: RingMode, input: RingInput) = mappings[mode]?.get(input.id) ?: input.action
}
data class ProfileDocument(val activeId: String = "default", val profiles: List<ControlProfile> = listOf(defaultProfile())) {
    fun active() = profiles.firstOrNull { it.id == activeId } ?: profiles.first()
}
fun defaultProfile() = ControlProfile("default", "Everyday", RingProtocol.defaults())

object Profiles {
    const val MAX_BYTES = 65536
    private val json = Json { prettyPrint = true; isLenient = false }
    private fun name(raw: String): String {
        val result = raw.trim()
        require(result.isNotEmpty() && result.length <= 32 && result.none { it < ' ' || it == '<' || it == '>' }) {
            "Use a profile name between 1 and 32 characters."
        }
        return result
    }
    private fun JsonObject.string(key: String): String {
        val value = this[key] as? JsonPrimitive
        require(value?.isString == true) { "This profile has an invalid $key." }
        return value.content
    }
    private fun parseMappings(value: JsonElement?): Map<RingMode, Map<String, RingAction>> {
        val root = value as? JsonObject ?: error("This profile is missing its controls.")
        require(root.keys == RingMode.entries.map { it.id }.toSet()) { "This profile has missing or unknown modes." }
        return RingProtocol.inputs.mapValues { (mode, inputs) ->
            val group = root[mode.id] as? JsonObject ?: error("This profile is missing a mode.")
            require(group.keys == inputs.map { it.id }.toSet()) { "This profile has missing or unknown gestures." }
            inputs.associate { input ->
                val raw = group[input.id] as? JsonPrimitive
                require(raw?.isString == true) { "This profile has an invalid action." }
                val action = RingAction.entries.firstOrNull { it.name == raw.content }
                    ?: error("This profile contains an unsupported action.")
                input.id to action
            }
        }
    }
    private fun mappingsJson(profile: ControlProfile) = buildJsonObject {
        for ((mode, values) in profile.mappings) put(mode.id, buildJsonObject { values.forEach { (input, action) -> put(input, action.name) } })
    }
    fun export(profile: ControlProfile): String = json.encodeToString(JsonObject.serializer(), buildJsonObject {
        put("format", "sensering-profile"); put("version", 1); put("name", profile.name); put("mappings", mappingsJson(profile))
    })
    fun parseImport(raw: String): ControlProfile {
        require(raw.toByteArray().size <= MAX_BYTES) { "Choose a profile smaller than 64 KB." }
        val root = json.parseToJsonElement(raw) as? JsonObject ?: error("This file is not a SenseRing profile.")
        require(root.string("format") == "sensering-profile" && root["version"] == JsonPrimitive(1)) { "This profile version is not supported." }
        return ControlProfile("p_${UUID.randomUUID()}", name(root.string("name")), parseMappings(root["mappings"]))
    }
    fun create(document: ProfileDocument, rawName: String, mappings: Map<RingMode, Map<String, RingAction>> = document.active().mappings): ProfileDocument {
        require(document.profiles.size < 16) { "You can save up to 16 profiles." }
        val title = name(rawName)
        require(document.profiles.none { it.name.equals(title, true) }) { "A profile with that name already exists." }
        val profile = ControlProfile("p_${UUID.randomUUID()}", title, mappings.mapValues { it.value.toMap() })
        return document.copy(activeId = profile.id, profiles = document.profiles + profile)
    }
    fun select(document: ProfileDocument, id: String): ProfileDocument {
        require(document.profiles.any { it.id == id }) { "Profile not found." }
        return document.copy(activeId = id)
    }
    fun rename(document: ProfileDocument, rawName: String): ProfileDocument {
        val title = name(rawName)
        require(document.profiles.none { it.id != document.activeId && it.name.equals(title, true) }) { "A profile with that name already exists." }
        return document.copy(profiles = document.profiles.map { if (it.id == document.activeId) it.copy(name = title) else it })
    }
    fun removeActive(document: ProfileDocument): ProfileDocument {
        require(document.activeId != "default") { "The Everyday profile cannot be deleted." }
        return document.copy(activeId = "default", profiles = document.profiles.filterNot { it.id == document.activeId })
    }
    fun remap(document: ProfileDocument, mode: RingMode, inputId: String, action: RingAction): ProfileDocument {
        require(RingProtocol.inputs.getValue(mode).any { it.id == inputId }) { "Gesture not found." }
        return document.copy(profiles = document.profiles.map { profile ->
            if (profile.id != document.activeId) profile else profile.copy(mappings = profile.mappings +
                (mode to (profile.mappings.getValue(mode) + (inputId to action))))
        })
    }
    fun reset(document: ProfileDocument) = document.copy(profiles = document.profiles.map {
        if (it.id == document.activeId) it.copy(mappings = RingProtocol.defaults()) else it
    })
    fun import(document: ProfileDocument, raw: String): ProfileDocument {
        val profile = parseImport(raw)
        var title = profile.name
        var index = 2
        while (document.profiles.any { it.name.equals(title, true) }) {
            val suffix = " ${index++}"
            title = profile.name.take(32 - suffix.length) + suffix
        }
        return create(document, title, profile.mappings)
    }
    fun serialize(document: ProfileDocument) = json.encodeToString(JsonObject.serializer(), buildJsonObject {
        put("version", 1); put("activeId", document.activeId)
        put("profiles", buildJsonArray { document.profiles.forEach { profile -> add(buildJsonObject {
            put("id", profile.id); put("name", profile.name); put("mappings", mappingsJson(profile))
        }) } })
    })
    fun restore(raw: String): ProfileDocument {
        require(raw.toByteArray().size <= MAX_BYTES * 16) { "Saved controls are too large." }
        val root = json.parseToJsonElement(raw).jsonObject
        require(root["version"] == JsonPrimitive(1))
        val list = root["profiles"]?.jsonArray ?: error("Missing profiles")
        require(list.size in 1..16)
        val profiles = list.map { value ->
            val entry = value.jsonObject
            val id = entry.string("id")
            require(Regex("[a-zA-Z0-9_-]{1,64}").matches(id))
            ControlProfile(id, name(entry.string("name")), parseMappings(entry["mappings"]))
        }
        require(profiles.map { it.id }.toSet().size == profiles.size)
        require(profiles.map { it.name.lowercase() }.toSet().size == profiles.size)
        require(profiles.any { it.id == "default" })
        val requested = root.string("activeId")
        return ProfileDocument(if (profiles.any { it.id == requested }) requested else "default", profiles)
    }
}
