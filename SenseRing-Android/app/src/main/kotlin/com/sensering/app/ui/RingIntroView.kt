package com.sensering.app.ui

import android.content.Context
import android.graphics.SurfaceTexture
import android.opengl.*
import android.os.Handler
import android.os.HandlerThread
import android.view.TextureView
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.*

/** A launch-only GL surface. Frames are requested, never polled or queued in a loop. */
class RingIntroView(context:Context):TextureView(context),TextureView.SurfaceTextureListener {
    var onReady:()->Unit={}
    var onFailure:()->Unit={}
    private var session:Session?=null
    private var pose=IntroPose()
    init {isOpaque=false;surfaceTextureListener=this;importantForAccessibility=IMPORTANT_FOR_ACCESSIBILITY_NO}
    fun setPose(value:IntroPose){pose=value;session?.update(value)}
    override fun onSurfaceTextureAvailable(texture:SurfaceTexture,width:Int,height:Int){
        val next=Session(context.applicationContext,texture,width,height,
            ready={post{if(session!=null)onReady()}},failed={post{onFailure()}})
        session=next;next.update(pose)
    }
    override fun onSurfaceTextureSizeChanged(texture:SurfaceTexture,width:Int,height:Int){session?.resize(width,height)}
    override fun onSurfaceTextureUpdated(texture:SurfaceTexture){}
    override fun onSurfaceTextureDestroyed(texture:SurfaceTexture):Boolean{
        val previous=session;session=null
        if(previous==null)texture.release() else previous.close()
        return false // The worker releases this texture after it releases its EGL surface.
    }
    private class Session(context:Context,private val texture:SurfaceTexture,width:Int,height:Int,ready:()->Unit,failed:()->Unit){
        private val thread=HandlerThread("SenseRing-intro").apply{start()}
        private val handler=Handler(thread.looper)
        private val queued=AtomicBoolean(false)
        @Volatile private var closed=false
        @Volatile private var pose=IntroPose()
        private var scene:IntroScene?=null
        init {handler.post{
            try {if(!closed){scene=IntroScene(context,texture,width,height);scene?.draw(pose);ready()}}
            catch(error:Exception){android.util.Log.w("SenseRingIntro","Launch graphics unavailable",error);scene?.close();scene=null;failed()}
        }}
        fun update(value:IntroPose){
            pose=value
            if(closed||!queued.compareAndSet(false,true))return
            handler.post{queued.set(false);if(!closed)runCatching{scene?.draw(pose)}}
        }
        fun resize(width:Int,height:Int){if(!closed)handler.post{scene?.resize(width,height)}}
        fun close(){
            if(closed)return;closed=true
            handler.post{scene?.close();scene=null;texture.release();thread.quitSafely()}
        }
    }
}

data class IntroPose(val yaw:Float=-.72f,val exploded:Float=0f,val scale:Float=1f)

/** Uses the unchanged 26-part CAD asset, on the dedicated intro GL worker. */
private class IntroScene(context:Context,private val texture:SurfaceTexture,width:Int,height:Int){
    private data class Batch(val vertices:FloatBuffer,val count:Int,val group:String,val metal:Float)
    private val display=EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    private var eglContext:EGLContext=EGL14.EGL_NO_CONTEXT
    private var surface:EGLSurface=EGL14.EGL_NO_SURFACE
    private var program=0
    private var w=1
    private var h=1
    private var batches=emptyList<Batch>()
    private val projection=FloatArray(16)
    private val view=FloatArray(16)
    private val vp=FloatArray(16)
    private val model=FloatArray(16)
    private val base=FloatArray(16)
    private val uniforms=mutableMapOf<String,Int>()
    private val attributes=mutableMapOf<String,Int>()
    init {
        try {
            check(display!=EGL14.EGL_NO_DISPLAY&&EGL14.eglInitialize(display,IntArray(2),0,IntArray(2),0))
            val configs=arrayOfNulls<EGLConfig>(1)
            val configAttributes=intArrayOf(EGL14.EGL_RENDERABLE_TYPE,EGL14.EGL_OPENGL_ES2_BIT,EGL14.EGL_RED_SIZE,8,EGL14.EGL_GREEN_SIZE,8,EGL14.EGL_BLUE_SIZE,8,EGL14.EGL_ALPHA_SIZE,8,EGL14.EGL_DEPTH_SIZE,16,EGL14.EGL_SURFACE_TYPE,EGL14.EGL_WINDOW_BIT,EGL14.EGL_NONE)
            val count=IntArray(1)
            check(EGL14.eglChooseConfig(display,configAttributes,0,configs,0,1,count,0)&&count[0]>0)
            eglContext=EGL14.eglCreateContext(display,configs[0],EGL14.EGL_NO_CONTEXT,intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION,2,EGL14.EGL_NONE),0)
            check(eglContext!=EGL14.EGL_NO_CONTEXT)
            resize(width,height)
            surface=EGL14.eglCreateWindowSurface(display,configs[0],texture,intArrayOf(EGL14.EGL_NONE),0)
            check(surface!=EGL14.EGL_NO_SURFACE&&EGL14.eglMakeCurrent(display,surface,surface,eglContext))
            val vertex=shader(GLES20.GL_VERTEX_SHADER,VERTEX)
            val fragment=shader(GLES20.GL_FRAGMENT_SHADER,FRAGMENT)
            program=GLES20.glCreateProgram()
            GLES20.glAttachShader(program,vertex);GLES20.glAttachShader(program,fragment);GLES20.glLinkProgram(program)
            GLES20.glDeleteShader(vertex);GLES20.glDeleteShader(fragment)
            val linked=IntArray(1);GLES20.glGetProgramiv(program,GLES20.GL_LINK_STATUS,linked,0);check(linked[0]!=0){GLES20.glGetProgramInfoLog(program)}
            for(name in listOf("uModel","uVP","uCamera","uMetal","uAlpha"))uniforms[name]=GLES20.glGetUniformLocation(program,name)
            for(name in listOf("aPosition","aNormal","aColor"))attributes[name]=GLES20.glGetAttribLocation(program,name)
            batches=load(context)
            GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glDepthFunc(GLES20.GL_LEQUAL)
            GLES20.glEnable(GLES20.GL_CULL_FACE);GLES20.glClearColor(0f,0f,0f,0f)
        } catch(error:Exception){close();throw error}
    }
    fun resize(width:Int,height:Int){
        val ratio=min(1f,1000f/width.coerceAtLeast(1));w=(width*ratio).roundToInt().coerceAtLeast(1);h=(height*ratio).roundToInt().coerceAtLeast(1)
        texture.setDefaultBufferSize(w,h)
    }
    fun draw(pose:IntroPose){
        if(program==0)return
        GLES20.glViewport(0,0,w,h);GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT);GLES20.glUseProgram(program)
        val distance=5.55f+pose.exploded*.55f
        Matrix.perspectiveM(projection,0,38f,w.toFloat()/h,.1f,30f)
        Matrix.setLookAtM(view,0,0f,0f,distance,0f,0f,0f,0f,1f,0f)
        Matrix.multiplyMM(vp,0,projection,0,view,0)
        GLES20.glUniformMatrix4fv(uniforms.getValue("uVP"),1,false,vp,0)
        GLES20.glUniform3f(uniforms.getValue("uCamera"),0f,0f,distance)
        Matrix.setIdentityM(base,0);Matrix.rotateM(base,0,-8f,0f,0f,1f);Matrix.rotateM(base,0,22f,1f,0f,0f);Matrix.rotateM(base,0,pose.yaw*180f/PI.toFloat(),0f,1f,0f);Matrix.scaleM(base,0,pose.scale,pose.scale,pose.scale)
        // Opaque parts precede the transparent base so the inner components remain solid.
        for(batch in batches.sortedBy{it.group=="ring_base"&&pose.exploded>0f}){
            base.copyInto(model)
            val offset=when(batch.group){"left_cover"->-.67f;"right_cover"->.67f;else->0f}*pose.exploded
            Matrix.translateM(model,0,offset,0f,0f)
            val alpha=if(batch.group=="ring_base")1f-.92f*pose.exploded else 1f
            if(alpha<.999f){GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFuncSeparate(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA,GLES20.GL_ONE,GLES20.GL_ONE_MINUS_SRC_ALPHA);GLES20.glDepthMask(false)}
            else {GLES20.glDisable(GLES20.GL_BLEND);GLES20.glDepthMask(true)}
            GLES20.glUniformMatrix4fv(uniforms.getValue("uModel"),1,false,model,0)
            GLES20.glUniform1f(uniforms.getValue("uMetal"),batch.metal);GLES20.glUniform1f(uniforms.getValue("uAlpha"),alpha)
            for((name,offsetFloats) in listOf("aPosition" to 0,"aNormal" to 3,"aColor" to 6)){
                val attribute=attributes.getValue(name);batch.vertices.position(offsetFloats)
                GLES20.glEnableVertexAttribArray(attribute);GLES20.glVertexAttribPointer(attribute,3,GLES20.GL_FLOAT,false,36,batch.vertices)
            }
            GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,batch.count)
        }
        GLES20.glDepthMask(true);GLES20.glDisable(GLES20.GL_BLEND)
        EGL14.eglSwapBuffers(display,surface)
    }
    fun close(){
        if(program!=0){GLES20.glDeleteProgram(program);program=0}
        if(display!=EGL14.EGL_NO_DISPLAY){
            EGL14.eglMakeCurrent(display,EGL14.EGL_NO_SURFACE,EGL14.EGL_NO_SURFACE,EGL14.EGL_NO_CONTEXT)
            if(surface!=EGL14.EGL_NO_SURFACE)EGL14.eglDestroySurface(display,surface)
            if(eglContext!=EGL14.EGL_NO_CONTEXT)EGL14.eglDestroyContext(display,eglContext)
            EGL14.eglReleaseThread();EGL14.eglTerminate(display)
        }
        surface=EGL14.EGL_NO_SURFACE;eglContext=EGL14.EGL_NO_CONTEXT;batches=emptyList()
    }
    private fun shader(type:Int,source:String):Int{
        val shader=GLES20.glCreateShader(type);GLES20.glShaderSource(shader,source);GLES20.glCompileShader(shader)
        val status=IntArray(1);GLES20.glGetShaderiv(shader,GLES20.GL_COMPILE_STATUS,status,0)
        if(status[0]==0){val message=GLES20.glGetShaderInfoLog(shader);GLES20.glDeleteShader(shader);error(message)}
        return shader
    }
    private fun load(context:Context):List<Batch>{
        val root=context.assets.open("ring/ring-assembly.json").bufferedReader().use{JSONObject(it.readText())}
        val parts=root.getJSONArray("parts")
        val low=DoubleArray(3){Double.POSITIVE_INFINITY};val high=DoubleArray(3){Double.NEGATIVE_INFINITY}
        for(i in 0 until parts.length()){
            val part=parts.getJSONObject(i);if(part.getString("name") !in setOf("ring_base","left_cover","right_cover"))continue
            val v=part.getJSONArray("vertices")
            for(j in 0 until v.length())for(k in 0..2){val x=v.getJSONArray(j).getDouble(k);low[k]=min(low[k],x);high[k]=max(high[k],x)}
        }
        val center=DoubleArray(3){(low[it]+high[it])/2};val unit=(0..2).maxOf{high[it]-low[it]}/2
        require(unit.isFinite()&&unit>0)
        return (0 until parts.length()).map{i->
            val part=parts.getJSONObject(i);val raw=part.getJSONArray("vertices");val faces=part.getJSONArray("triangles");val color=part.getJSONArray("color")
            val vertices=Array(raw.length()){j->val v=raw.getJSONArray(j);floatArrayOf(((v.getDouble(0)-center[0])/unit).toFloat(),((v.getDouble(2)-center[2])/unit).toFloat(),(-(v.getDouble(1)-center[1])/unit).toFloat())}
            val values=FloatArray(faces.length()*27)
            for(j in 0 until faces.length()){
                val indices=faces.getJSONArray(j);val a=vertices[indices.getInt(0)];val b=vertices[indices.getInt(1)];val c=vertices[indices.getInt(2)]
                val ab=FloatArray(3){b[it]-a[it]};val ac=FloatArray(3){c[it]-a[it]}
                val normal=floatArrayOf(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);val length=sqrt(normal.sumOf{(it*it).toDouble()}).toFloat().coerceAtLeast(.000001f)
                for(k in 0..2){val at=j*27+k*9;vertices[indices.getInt(k)].copyInto(values,at);for(n in 0..2){values[at+3+n]=normal[n]/length;values[at+6+n]=color.getDouble(n).toFloat()}}
            }
            Batch(ByteBuffer.allocateDirect(values.size*4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply{put(values);position(0)},values.size/9,part.optString("group",part.getString("name")),part.optDouble("metal",0.0).toFloat())
        }
    }
    companion object {
        private const val VERTEX="""
            attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
            uniform mat4 uModel; uniform mat4 uVP;
            varying mediump vec3 vPosition; varying mediump vec3 vNormal; varying mediump vec3 vColor;
            void main(){vec4 world=uModel*vec4(aPosition,1.0);vPosition=world.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uVP*world;}
        """
        private const val FRAGMENT="""
            precision mediump float;
            varying mediump vec3 vPosition; varying mediump vec3 vNormal; varying mediump vec3 vColor;
            uniform vec3 uCamera; uniform float uMetal; uniform float uAlpha;
            void main(){
                vec3 n=normalize(vNormal),v=normalize(uCamera-vPosition);
                vec3 key=normalize(vec3(-3.0,4.0,5.0)-vPosition),fill=normalize(vec3(4.0,1.0,2.0)-vPosition);
                float light=.37+.57*max(dot(n,key),0.0)+.19*max(dot(n,fill),0.0);
                float spec=pow(max(dot(n,normalize(key+v)),0.0),mix(28.0,85.0,uMetal));
                vec3 color=pow(vColor,vec3(2.2))*light+vec3(.80,.85,.92)*spec*mix(.07,.46,uMetal);
                color+=vec3(.018,.023,.032)*pow(1.0-max(dot(n,v),0.0),4.0);
                gl_FragColor=vec4(pow(max(color,vec3(0.0)),vec3(.4545)),uAlpha);
            }
        """
    }
}
