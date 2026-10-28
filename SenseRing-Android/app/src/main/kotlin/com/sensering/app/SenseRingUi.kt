@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.sensering.app

import android.os.Build
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.automirrored.rounded.VolumeDown
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sensering.app.ui.*
import com.sensering.core.*

@Composable fun SenseRingUi(runtime: RingRuntime,access: AccessStatus,apps: List<PresentationApp>,actions: ScreenActions) {
    val state by runtime.state.collectAsStateWithLifecycle()
    val config by runtime.store.configuration.collectAsStateWithLifecycle()
    var page by rememberSaveable { mutableIntStateOf(0) }
    var introFinished by rememberSaveable { mutableStateOf(false) }
    val ringScroll=rememberLazyListState()
    val controlsScroll=rememberLazyListState()
    val settingsScroll=rememberLazyListState()
    SenseRingTheme(config.appearance){
        if(!introFinished){LaunchSequence(onFinished={introFinished=true});return@SenseRingTheme}
        val colors=LocalGlassColors.current
        Box(Modifier.fillMaxSize()){
            AppBackground(Modifier.fillMaxSize())
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(bottom=80.dp)){
                Row(Modifier.fillMaxWidth().padding(horizontal=24.dp,vertical=14.dp),verticalAlignment=Alignment.CenterVertically){
                    Icon(Icons.Rounded.RadioButtonUnchecked,"SenseRing",tint=colors.accent,modifier=Modifier.size(24.dp))
                    Spacer(Modifier.width(9.dp));Text("SenseRing",fontSize=23.sp,fontWeight=FontWeight.SemiBold,color=colors.ink,letterSpacing=(-.8).sp)
                    Text(".",fontSize=26.sp,fontWeight=FontWeight.Bold,color=colors.accent)
                    Spacer(Modifier.weight(1f))
                    if(state.connection==LinkState.READY)BatteryIndicator()
                    else Text(if(state.serviceRunning)state.connection.title else "Not connected",fontSize=11.sp,color=colors.muted)
                }
                when(page){
                    0->RingPage(runtime,state,config,access,actions,ringScroll){page=2}
                    1->ControlsPage(runtime,config,actions,controlsScroll)
                    else->SettingsPage(state,config,access,apps,actions,settingsScroll)
                }
            }
            Surface(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom=10.dp).width(252.dp).height(58.dp).testTag("bottom-navigation"),shape=CircleShape,color=colors.panel.copy(alpha=.97f),contentColor=colors.ink,border=BorderStroke(.8.dp,colors.line),shadowElevation=7.dp){
                Row(Modifier.fillMaxSize().padding(4.dp).selectableGroup(),horizontalArrangement=Arrangement.spacedBy(3.dp),verticalAlignment=Alignment.CenterVertically){
                    listOf("Ring" to Icons.Rounded.RadioButtonUnchecked,"Controls" to Icons.Rounded.Tune,"Settings" to Icons.Rounded.Settings).forEachIndexed{index,(title,icon)->
                        val selected=page==index
                        Row(Modifier.weight(if(selected)1.6f else 1f).fillMaxHeight().clip(CircleShape).background(if(selected)colors.accent.copy(alpha=.12f)else Color.Transparent).semantics{contentDescription=title}.selectable(selected=selected,role=Role.Tab,onClick={page=index}),horizontalArrangement=Arrangement.Center,verticalAlignment=Alignment.CenterVertically){
                            Icon(icon,null,tint=if(selected)colors.accent else colors.muted,modifier=Modifier.size(20.dp))
                            if(selected){Spacer(Modifier.width(6.dp));Text(title,fontSize=11.sp,fontWeight=FontWeight.Medium,color=colors.ink,maxLines=1)}
                        }
                    }
                }
            }
            val notice=state.notice
            if(notice!=null)Snackbar(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(start=16.dp,end=16.dp,bottom=82.dp),action={TextButton(onClick={runtime.notice(null)}){Text("OK")}}){Text(notice)}
        }
    }
}

@Composable private fun BatteryIndicator(){
    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(3.dp)){
        Icon(Icons.Rounded.BatteryAlert,"Ring connected. Fixed battery indicator, 2 percent.",tint=Color(0xFFE4757A),modifier=Modifier.size(21.dp))
        Text("2%",fontSize=12.sp,color=LocalGlassColors.current.ink)
    }
}
@Composable private fun PageHeading(eyebrow: String,title: String,aside: (@Composable () -> Unit)?=null){
    val colors=LocalGlassColors.current
    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
        Column(Modifier.weight(1f)){Text(eyebrow.uppercase(),fontSize=10.sp,letterSpacing=1.5.sp,color=colors.muted);Spacer(Modifier.height(6.dp));Text(title,style=MaterialTheme.typography.headlineLarge,color=colors.ink)}
        aside?.invoke()
    }
}
@Composable private fun SectionTitle(title: String,detail: String?=null){
    Text(title,fontSize=17.sp,fontWeight=FontWeight.Medium,color=LocalGlassColors.current.ink)
    if(detail!=null){Spacer(Modifier.height(5.dp));Text(detail,style=MaterialTheme.typography.bodySmall,color=LocalGlassColors.current.muted)}
}
@Composable private fun ModeToggle(mode: RingMode,pending: Boolean,onMode: (RingMode)->Unit){
    val colors=LocalGlassColors.current
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp)).background(colors.page.copy(alpha=.65f)).padding(4.dp)){
        RingMode.entries.forEach{item->
            val selected=item==mode
            Row(Modifier.weight(1f).clip(RoundedCornerShape(15.dp)).background(if(selected)colors.accent.copy(alpha=if(colors.dark).19f else .12f)else Color.Transparent).clickable(enabled=!pending){onMode(item)}.padding(vertical=12.dp),horizontalArrangement=Arrangement.Center,verticalAlignment=Alignment.CenterVertically){
                Icon(if(item==RingMode.MUSIC)Icons.Rounded.MusicNote else Icons.Rounded.Slideshow,null,tint=if(selected)colors.accent else colors.muted,modifier=Modifier.size(18.dp))
                Spacer(Modifier.width(7.dp));Text(item.title,fontSize=13.sp,fontWeight=FontWeight.Medium,color=if(selected)colors.ink else colors.muted)
            }
        }
    }
}
@Composable private fun RingPage(runtime: RingRuntime,state: RingState,config: AppConfiguration,access: AccessStatus,actions: ScreenActions,listState: LazyListState,openSettings: ()->Unit){
    val colors=LocalGlassColors.current
    val mode=state.mode?:RingMode.MUSIC
    var previews by rememberSaveable{mutableStateOf(false)}
    val busy=state.connection==LinkState.CONNECTING||state.connection==LinkState.SYNCING
    LazyColumn(Modifier.fillMaxSize(),state=listState,contentPadding=PaddingValues(start=20.dp,end=20.dp,top=6.dp,bottom=24.dp),verticalArrangement=Arrangement.spacedBy(18.dp)){
        item {PageHeading(config.profiles.active().name,"Dashboard"){
            if(state.connection==LinkState.READY)StatusPill("Connected",true) else StatusPill(if(state.serviceRunning||state.connection==LinkState.SLEEPING)state.connection.title else "Ready to connect")
        }}
        item {GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(15.dp)){
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(9.dp)){
                    Icon(Icons.Rounded.Bluetooth,null,tint=colors.accent,modifier=Modifier.size(19.dp))
                    Text("Ring connection",fontSize=13.sp,fontWeight=FontWeight.Medium,color=colors.ink)
                }
                ModeToggle(mode,state.pendingMode!=null||busy,runtime::requestMode)
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically){
                    Button(onClick={if(state.connection==LinkState.READY)actions.disconnectRing()else actions.connectRing()},enabled=!busy,modifier=Modifier.weight(1f).heightIn(min=49.dp),shape=RoundedCornerShape(17.dp)){
                        if(busy){CircularProgressIndicator(Modifier.size(16.dp),strokeWidth=2.dp,color=MaterialTheme.colorScheme.onPrimary);Spacer(Modifier.width(9.dp))}
                        Text(when{state.connection==LinkState.READY->"Disconnect ring";busy->state.connection.title;state.serviceRunning->"Retry connection";else->"Connect ring"},fontWeight=FontWeight.Medium)
                    }
                    IconButton(onClick=runtime::sleep,enabled=state.connection==LinkState.READY&&state.pendingMode==null,modifier=Modifier.size(49.dp).clip(RoundedCornerShape(16.dp)).background(colors.page.copy(alpha=.6f))){Icon(Icons.Rounded.Bedtime,"Put ring to sleep",modifier=Modifier.size(21.dp))}
                }
                Text(when{state.pendingMode!=null->"Switching to ${state.pendingMode.title}…";state.connection==LinkState.SLEEPING->"Hold the ring’s button to wake it, then reconnect.";state.connection==LinkState.READY->"${mode.title} controls stay connected in the background.";else->"Disconnect the ring from your laptop before connecting here."},fontSize=11.sp,lineHeight=17.sp,color=colors.muted,modifier=Modifier.padding(horizontal=3.dp))
            }
        }}
        if(config.profiles.active().mappings.getValue(mode).values.any{it.isPresentation}&&(!access.presentations||(config.touchScope==TouchScope.SELECTED_APP&&config.presentationPackage.isBlank())))item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(19.dp)){SectionTitle("Use the ring in your apps","Allow touch controls for swipes and taps across your apps.");TextButton(onClick=openSettings,contentPadding=PaddingValues(top=9.dp)){Text("Set up app controls");Spacer(Modifier.width(6.dp));Icon(Icons.AutoMirrored.Rounded.ArrowForward,null,Modifier.size(16.dp))}}
        }}
        item {GlassCard(Modifier.fillMaxWidth()){
            val last=state.activities.firstOrNull()
            Column(Modifier.padding(21.dp)){
                Text("IN THE MOMENT",fontSize=10.sp,letterSpacing=1.3.sp,color=colors.muted)
                Spacer(Modifier.height(19.dp));Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(15.dp)){
                    Box(Modifier.size(53.dp).clip(RoundedCornerShape(18.dp)).background(colors.accent.copy(alpha=.12f)),contentAlignment=Alignment.Center){Icon(actionIcon(last?.action),null,tint=colors.accent,modifier=Modifier.size(27.dp))}
                    Column(Modifier.weight(1f)){Text(last?.action?.title?:"Waiting for your ring",fontSize=21.sp,fontWeight=FontWeight.Medium,color=colors.ink);Spacer(Modifier.height(5.dp));Text(if(last==null)"Your next gesture will appear here." else "${last.input} · ${last.detail}",fontSize=12.sp,color=colors.muted)}
                }
            }
        }}
        item {GlassCard(Modifier.fillMaxWidth()){
            Row(Modifier.fillMaxWidth().clickable{previews=!previews}.padding(20.dp),verticalAlignment=Alignment.CenterVertically){
                Icon(Icons.Rounded.TouchApp,null,tint=colors.accent,modifier=Modifier.size(20.dp));Spacer(Modifier.width(10.dp));Text("Try your controls",fontSize=14.sp,fontWeight=FontWeight.Medium,color=colors.ink);Spacer(Modifier.weight(1f));Icon(if(previews)Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,null,tint=colors.muted)
            }
            AnimatedVisibility(previews){Column(Modifier.padding(start=14.dp,end=14.dp,bottom=18.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                RingProtocol.inputs.getValue(mode).chunked(2).forEach{row->Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    row.forEach{input->OutlinedButton(onClick={runtime.preview(mode,input)},modifier=Modifier.weight(1f).heightIn(min=57.dp),shape=RoundedCornerShape(15.dp),contentPadding=PaddingValues(horizontal=7.dp,vertical=10.dp)){Text(input.label,fontSize=11.sp,maxLines=2)}}
                    if(row.size==1)Spacer(Modifier.weight(1f))
                }}
                Text("Preview only. Use the ring to control your phone.",fontSize=10.sp,color=colors.muted,modifier=Modifier.padding(horizontal=5.dp,vertical=3.dp))
            }}
        }}
        if(state.activities.isNotEmpty())item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(20.dp)){
                Row(verticalAlignment=Alignment.CenterVertically){SectionTitle("Activity");Spacer(Modifier.weight(1f));TextButton(onClick=runtime::clearActivity){Text("Clear",fontSize=11.sp)}}
                state.activities.forEachIndexed{index,activity->
                    if(index>0)HorizontalDivider(color=colors.line,modifier=Modifier.padding(vertical=11.dp))
                    Row(horizontalArrangement=Arrangement.spacedBy(13.dp),verticalAlignment=Alignment.Top){Text(activity.time,fontSize=10.sp,color=colors.muted,modifier=Modifier.width(58.dp));Column{Text(activity.action.title,fontSize=13.sp,color=colors.ink);Text("${activity.input} · ${activity.detail}",fontSize=11.sp,color=colors.muted)}}
                }
            }
        }}
    }
}
@Composable private fun StatusPill(title: String,connected: Boolean=false){
    val colors=LocalGlassColors.current
    Text(title,fontSize=10.sp,color=if(connected)colors.mint else colors.muted,modifier=Modifier.clip(CircleShape).background((if(connected)colors.mint else colors.muted).copy(alpha=.10f)).padding(horizontal=11.dp,vertical=7.dp))
}

@Composable private fun ControlsPage(runtime: RingRuntime,config: AppConfiguration,actions: ScreenActions,listState: LazyListState){
    val colors=LocalGlassColors.current
    var profilesOpen by remember{mutableStateOf(false)}
    var menuOpen by remember{mutableStateOf(false)}
    var editName by remember{mutableStateOf<String?>(null)}
    var nameValue by remember{mutableStateOf("")}
    var deleteConfirm by remember{mutableStateOf(false)}
    var selectedMapping by remember{mutableStateOf<Pair<RingMode,RingInput>?>(null)}
    LazyColumn(Modifier.fillMaxSize(),state=listState,contentPadding=PaddingValues(20.dp,6.dp,20.dp,24.dp),verticalArrangement=Arrangement.spacedBy(18.dp)){
        item{PageHeading("Gestures","Your controls")}
        item{GlassCard(Modifier.fillMaxWidth()){
            Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically){
                Box(Modifier.weight(1f)){
                    TextButton(onClick={profilesOpen=true},contentPadding=PaddingValues(3.dp)){Icon(Icons.Rounded.Tune,null,Modifier.size(19.dp));Spacer(Modifier.width(9.dp));Text(config.profiles.active().name,fontSize=16.sp,maxLines=1,overflow=TextOverflow.Ellipsis);Icon(Icons.Rounded.ExpandMore,null)}
                    DropdownMenu(profilesOpen,{profilesOpen=false}){config.profiles.profiles.forEach{profile->DropdownMenuItem(text={Text(profile.name)},onClick={profilesOpen=false;actions.changeProfiles{Profiles.select(it,profile.id)}})}}
                }
                IconButton(onClick={menuOpen=true}){Icon(Icons.Rounded.MoreHoriz,"Manage profiles")}
                DropdownMenu(menuOpen,{menuOpen=false}){
                    listOf("Save as","Rename","Import","Export","Reset controls","Delete profile").forEach{item->DropdownMenuItem(text={Text(item)},enabled=item!="Delete profile"||config.profiles.activeId!="default",onClick={
                        menuOpen=false
                        when(item){"Save as"->{editName="Save as";nameValue=""};"Rename"->{editName="Rename";nameValue=config.profiles.active().name};"Import"->actions.importProfile();"Export"->actions.exportProfile();"Reset controls"->actions.changeProfiles(Profiles::reset);else->deleteConfirm=true}
                    })}
                }
            }
        }}
        RingMode.entries.forEach{mode->item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(19.dp)){
                Row(verticalAlignment=Alignment.CenterVertically){Icon(if(mode==RingMode.MUSIC)Icons.Rounded.MusicNote else Icons.Rounded.TouchApp,null,tint=colors.accent);Spacer(Modifier.width(10.dp));SectionTitle(if(mode==RingMode.MUSIC)"Music" else "Apps & slides")}
                Spacer(Modifier.height(16.dp))
                RingProtocol.inputs.getValue(mode).forEachIndexed{index,input->
                    if(index>0)HorizontalDivider(color=colors.line)
                    Row(Modifier.fillMaxWidth().clickable{selectedMapping=mode to input}.padding(vertical=16.dp),verticalAlignment=Alignment.CenterVertically){
                        Column(Modifier.weight(1f)){Text(input.label,fontSize=13.sp,color=colors.ink);Spacer(Modifier.height(3.dp));Text(input.hint,fontSize=10.sp,color=colors.muted)}
                        Spacer(Modifier.width(12.dp));Text(config.profiles.active().action(mode,input).title,fontSize=11.sp,color=colors.accent,modifier=Modifier.widthIn(max=106.dp),maxLines=2)
                        Icon(Icons.Rounded.ChevronRight,null,tint=colors.muted,modifier=Modifier.size(17.dp))
                    }
                }
            }
        }}}
        item{Text("Your profiles stay on this phone. Import and export the same profile files used by the SenseRing website.",fontSize=12.sp,lineHeight=19.sp,color=colors.muted,modifier=Modifier.padding(horizontal=4.dp))}
    }
    if(editName!=null)AlertDialog(onDismissRequest={editName=null},title={Text(if(editName=="Save as")"Save a profile" else "Rename profile")},text={OutlinedTextField(value=nameValue,onValueChange={if(it.length<=32)nameValue=it},singleLine=true,label={Text("Profile name")})},confirmButton={TextButton(enabled=nameValue.isNotBlank(),onClick={val create=editName=="Save as";actions.changeProfiles{if(create)Profiles.create(it,nameValue)else Profiles.rename(it,nameValue)};editName=null}){Text("Save")}},dismissButton={TextButton(onClick={editName=null}){Text("Cancel")}})
    if(deleteConfirm)AlertDialog(onDismissRequest={deleteConfirm=false},title={Text("Delete profile?")},text={Text("Remove ${config.profiles.active().name} from this phone?")},confirmButton={TextButton(onClick={actions.changeProfiles(Profiles::removeActive);deleteConfirm=false}){Text("Delete")}},dismissButton={TextButton(onClick={deleteConfirm=false}){Text("Cancel")}})
    selectedMapping?.let{(mode,input)->ModalBottomSheet(onDismissRequest={selectedMapping=null}){
        Column(Modifier.fillMaxWidth().padding(horizontal=24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding()){
            Text(input.label,style=MaterialTheme.typography.titleLarge);Spacer(Modifier.height(8.dp));Text("Choose what this gesture does.",color=colors.muted)
            RingAction.entries.forEach{action->ListItem(headlineContent={Text(action.title)},leadingContent={Icon(actionIcon(action),null)},trailingContent={if(config.profiles.active().action(mode,input)==action)Icon(Icons.Rounded.Check,null,tint=colors.accent)},modifier=Modifier.clickable{actions.changeProfiles{Profiles.remap(it,mode,input.id,action)};selectedMapping=null},colors=ListItemDefaults.colors(containerColor=Color.Transparent))}
            Spacer(Modifier.height(20.dp))
        }
    }}
}

@Composable private fun SettingsPage(state: RingState,config: AppConfiguration,access: AccessStatus,apps: List<PresentationApp>,actions: ScreenActions,listState: LazyListState){
    val colors=LocalGlassColors.current
    var showApps by remember{mutableStateOf(false)}
    var showDisclosure by remember{mutableStateOf(false)}
    var pendingScope by remember{mutableStateOf<TouchScope?>(null)}
    var forget by remember{mutableStateOf(false)}
    var search by remember{mutableStateOf("")}
    val chooseScope:(TouchScope)->Unit={scope->
        if(scope==TouchScope.ALL_APPS&&config.touchScope!=scope&&access.presentations){pendingScope=scope;showDisclosure=true}
        else actions.setTouchScope(scope)
    }
    LazyColumn(Modifier.fillMaxSize(),state=listState,contentPadding=PaddingValues(20.dp,6.dp,20.dp,24.dp),verticalArrangement=Arrangement.spacedBy(18.dp)){
        item{PageHeading("Preferences","Settings")}
        item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(20.dp)){
                SectionTitle("Your connection","Connect once, then use your other apps.");Spacer(Modifier.height(15.dp))
                SettingsRow(Icons.Rounded.Bluetooth,"Nearby devices",if(access.bluetooth)"Allowed" else "Allow connection",onClick=actions::connectRing)
                SettingsRow(Icons.Rounded.NotificationsNone,"Connection notification",if(access.notifications)"Allowed" else "Allow",onClick=actions::allowNotifications)
                SettingsRow(Icons.Rounded.Sync,"Background connection",if(state.serviceRunning)"Running" else "Starts when connected",onClick=actions::openAppSettings)
                Text("If your phone closes the connection, allow SenseRing to run in the background in its app battery settings.",fontSize=11.sp,lineHeight=17.sp,color=colors.muted,modifier=Modifier.padding(top=12.dp))
                TextButton(onClick=actions::openAppSettings,contentPadding=PaddingValues(top=9.dp)){Text("Open app settings",fontSize=12.sp)}
            }
        }}
        item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(20.dp)){
                SectionTitle("App controls","Swipes and taps for the app on screen.");Spacer(Modifier.height(14.dp))
                SettingsRow(Icons.Rounded.TouchApp,"Touch-control access",if(access.presentations)"Enabled" else "Set up",onClick={pendingScope=null;showDisclosure=true})
                Spacer(Modifier.height(10.dp));Text("USE TOUCH CONTROLS IN",fontSize=10.sp,letterSpacing=1.sp,color=colors.muted)
                TouchScope.entries.forEach{scope->Row(Modifier.fillMaxWidth().clickable{chooseScope(scope)}.padding(vertical=2.dp),verticalAlignment=Alignment.CenterVertically){RadioButton(selected=config.touchScope==scope,onClick={chooseScope(scope)});Text(scope.title,fontSize=13.sp,color=colors.ink)}}
                if(config.touchScope==TouchScope.SELECTED_APP)SettingsRow(Icons.Rounded.Apps,"Chosen app",config.presentationName,onClick={showApps=true})
                Text("Music and volume work in the background. Swipes and taps need an unlocked, awake screen.",fontSize=11.sp,lineHeight=17.sp,color=colors.muted,modifier=Modifier.padding(top=10.dp))
                Spacer(Modifier.height(18.dp));Text("GESTURE STYLE",fontSize=10.sp,letterSpacing=1.sp,color=colors.muted);Spacer(Modifier.height(8.dp))
                SlideStyle.entries.filter{it!=SlideStyle.ARROW_KEYS||Build.VERSION.SDK_INT>=33}.forEach{style->
                    Row(Modifier.fillMaxWidth().clickable{actions.setSlideStyle(style)}.padding(vertical=5.dp),verticalAlignment=Alignment.CenterVertically){RadioButton(selected=config.slideStyle==style,onClick={actions.setSlideStyle(style)});Text(style.title,fontSize=13.sp,color=colors.ink)}
                }
                Text(when(config.slideStyle){SlideStyle.SWIPE_VERTICAL->"Next swipes up. Previous swipes down.";SlideStyle.SWIPE->"Next swipes left. Previous swipes right.";SlideStyle.TAP_EDGES->"Next taps the right edge. Previous taps the left edge.";SlideStyle.ARROW_KEYS->"Next uses Right. Previous uses Left; unsupported arrows use swipes."},fontSize=11.sp,lineHeight=17.sp,color=colors.muted,modifier=Modifier.padding(top=8.dp))
                if(Build.VERSION.SDK_INT>=33)Text("If Android blocks Accessibility, open App info and use Allow restricted settings from its menu, then return here.",fontSize=11.sp,lineHeight=17.sp,color=colors.muted,modifier=Modifier.padding(top=8.dp))
            }
        }}
        item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(20.dp)){
                SectionTitle("Appearance");Spacer(Modifier.height(13.dp))
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)){Appearance.entries.forEach{appearance->
                    FilterChip(selected=config.appearance==appearance,onClick={actions.setAppearance(appearance)},label={Text(appearance.name.lowercase().replaceFirstChar{it.uppercase()},fontSize=12.sp)},modifier=Modifier.weight(1f))
                }}
            }
        }}
        item{GlassCard(Modifier.fillMaxWidth()){
            Column(Modifier.padding(20.dp)){
                SectionTitle("About SenseRing");Spacer(Modifier.height(12.dp))
                Text("Small gestures. Everyday control.",fontSize=13.sp,color=colors.ink)
                Text("Android app ${BuildConfig.VERSION_NAME}${state.firmware?.let{" · Ring $it"}.orEmpty()}",fontSize=11.sp,color=colors.muted,modifier=Modifier.padding(top=6.dp))
                Spacer(Modifier.height(12.dp));Text("No account. No cloud connection. Profiles stay on your phone.",fontSize=12.sp,lineHeight=19.sp,color=colors.muted)
                if(config.address!=null){Spacer(Modifier.height(7.dp));TextButton(onClick={forget=true},contentPadding=PaddingValues(0.dp)){Text("Forget this ring",color=MaterialTheme.colorScheme.error,fontSize=12.sp)}}
            }
        }}
    }
    if(showDisclosure)AlertDialog(onDismissRequest={showDisclosure=false;pendingScope=null},icon={Icon(Icons.Rounded.TouchApp,null)},title={Text("Allow app controls")},text={Text("SenseRing uses Android’s Accessibility service to send your chosen taps, swipes and arrow actions ${if((pendingScope?:config.touchScope)==TouchScope.ALL_APPS)"in any app" else "in the app you choose"} while your phone is unlocked and awake. It checks which app is open without reading or storing screen text. Music controls work without this access.")},confirmButton={TextButton(onClick={val expanding=pendingScope!=null;pendingScope?.let(actions::setTouchScope);showDisclosure=false;pendingScope=null;if(!expanding||!access.presentations)actions.enablePresentation()}){Text(if(pendingScope!=null&&access.presentations)"Use all apps" else "Open settings")}},dismissButton={TextButton(onClick={showDisclosure=false;pendingScope=null}){Text("Cancel")}})
    if(forget)AlertDialog(onDismissRequest={forget=false},title={Text("Forget this ring?")},text={Text("This disconnects the ring and removes its saved connection. Your gesture profiles stay.")},confirmButton={TextButton(onClick={actions.forgetRing();forget=false}){Text("Forget ring")}},dismissButton={TextButton(onClick={forget=false}){Text("Cancel")}})
    if(showApps)ModalBottomSheet(onDismissRequest={showApps=false}){
        Column(Modifier.fillMaxWidth().padding(horizontal=22.dp).navigationBarsPadding()){
            Text("Choose an app",style=MaterialTheme.typography.titleLarge);Spacer(Modifier.height(12.dp))
            OutlinedTextField(search,{search=it},label={Text("Search apps")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(9.dp))
            LazyColumn(Modifier.heightIn(max=400.dp)){
                items(apps.filter{it.label.contains(search,true)},key={it.packageName}){app->ListItem(headlineContent={Text(app.label)},trailingContent={if(config.presentationPackage==app.packageName)Icon(Icons.Rounded.Check,null,tint=colors.accent)},colors=ListItemDefaults.colors(containerColor=Color.Transparent),modifier=Modifier.clickable{actions.choosePresentation(app);showApps=false})}
            }
            Spacer(Modifier.height(22.dp))
        }
    }
}
@Composable private fun SettingsRow(icon: ImageVector,title: String,value: String,onClick: ()->Unit){
    val colors=LocalGlassColors.current
    Row(Modifier.fillMaxWidth().clickable(onClick=onClick).padding(vertical=13.dp),verticalAlignment=Alignment.CenterVertically){
        Icon(icon,null,tint=colors.accent,modifier=Modifier.size(20.dp));Spacer(Modifier.width(12.dp));Text(title,fontSize=13.sp,color=colors.ink,modifier=Modifier.weight(1f));Spacer(Modifier.width(8.dp));Text(value,fontSize=11.sp,color=colors.muted,maxLines=1,overflow=TextOverflow.Ellipsis,modifier=Modifier.widthIn(max=112.dp));Icon(Icons.Rounded.ChevronRight,null,tint=colors.muted,modifier=Modifier.size(17.dp))
    }
}
private fun actionIcon(action: RingAction?): ImageVector=when(action){
    RingAction.NEXT->Icons.Rounded.SkipNext;RingAction.PREV->Icons.Rounded.SkipPrevious
    RingAction.VOL_UP->Icons.AutoMirrored.Rounded.VolumeUp;RingAction.VOL_DOWN->Icons.AutoMirrored.Rounded.VolumeDown
    RingAction.SLIDE_NEXT,RingAction.SCROLL_DOWN->Icons.AutoMirrored.Rounded.ArrowForward
    RingAction.SLIDE_PREV,RingAction.SCROLL_UP->Icons.AutoMirrored.Rounded.ArrowBack
    RingAction.SELECT->Icons.Rounded.CheckCircleOutline
    else->Icons.Rounded.PlayArrow
}
