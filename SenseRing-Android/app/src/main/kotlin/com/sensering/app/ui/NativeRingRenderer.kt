package com.sensering.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import kotlinx.coroutines.ensureActive
import org.json.JSONObject
import kotlin.coroutines.coroutineContext
import kotlin.math.*

/** Renders the actual CAD triangles off the UI thread, only when the view changes. */
object NativeRingRenderer {
    private data class V(val x:Double,val y:Double,val z:Double){
        operator fun plus(b:V)=V(x+b.x,y+b.y,z+b.z)
        operator fun minus(b:V)=V(x-b.x,y-b.y,z-b.z)
        operator fun times(k:Double)=V(x*k,y*k,z*k)
        fun dot(b:V)=x*b.x+y*b.y+z*b.z
        fun cross(b:V)=V(y*b.z-z*b.y,z*b.x-x*b.z,x*b.y-y*b.x)
        fun unit():V {val length=sqrt(dot(this));return if(length<1e-10)V(0.0,0.0,0.0)else this*(1/length)}
    }
    private data class Material(val linear:DoubleArray,val metal:Double,val group:String)
    private data class Face(val a:V,val b:V,val c:V,val normal:V,val material:Material)
    private data class Triangle(val points:FloatArray,val inverseDepth:FloatArray,val depth:Double,val color:Int)
    @Volatile private var cached:List<Face>?=null

    @Synchronized private fun mesh(context:Context):List<Face> {
        cached?.let{return it}
        val root=context.assets.open("ring/ring-assembly.json").bufferedReader().use{JSONObject(it.readText())}
        val parts=root.getJSONArray("parts")
        val low=doubleArrayOf(Double.POSITIVE_INFINITY,Double.POSITIVE_INFINITY,Double.POSITIVE_INFINITY)
        val high=doubleArrayOf(Double.NEGATIVE_INFINITY,Double.NEGATIVE_INFINITY,Double.NEGATIVE_INFINITY)
        for(i in 0 until parts.length()){
            val part=parts.getJSONObject(i)
            if(part.getString("name") !in setOf("ring_base","left_cover","right_cover"))continue
            val vertices=part.getJSONArray("vertices")
            for(j in 0 until vertices.length())for(k in 0..2){val v=vertices.getJSONArray(j).getDouble(k);low[k]=min(low[k],v);high[k]=max(high[k],v)}
        }
        val center=DoubleArray(3){(low[it]+high[it])/2}
        val unit=(0..2).maxOf{high[it]-low[it]}/2
        require(unit.isFinite()&&unit>0)
        val faces=ArrayList<Face>()
        for(i in 0 until parts.length()){
            val part=parts.getJSONObject(i)
            val color=part.getJSONArray("color")
            val material=Material(DoubleArray(3){color.getDouble(it).coerceIn(0.0,1.0).pow(2.2)},part.optDouble("metal",0.0),part.optString("group",part.getString("name")))
            val raw=part.getJSONArray("vertices")
            val vertices=Array(raw.length()){j->val v=raw.getJSONArray(j);V((v.getDouble(0)-center[0])/unit,(v.getDouble(2)-center[2])/unit,-(v.getDouble(1)-center[1])/unit)}
            val triangles=part.getJSONArray("triangles")
            for(j in 0 until triangles.length()){
                val indices=triangles.getJSONArray(j)
                val a=vertices[indices.getInt(0)];val b=vertices[indices.getInt(1)];val c=vertices[indices.getInt(2)]
                val normal=(b-a).cross(c-a).unit()
                if(normal.dot(normal)>.5)faces+=Face(a,b,c,normal,material)
            }
        }
        return faces.also{cached=it}
    }
    suspend fun render(context:Context,width:Int,height:Int,exploded:Boolean,yaw:Double=-.72,pitch:Double=.38):Bitmap {
        val faces=mesh(context)
        coroutineContext.ensureActive()
        val scale=min(1.5,1200.0/width.coerceAtLeast(1))
        val w=(width*scale).roundToInt().coerceAtLeast(1)
        val h=(height*scale).roundToInt().coerceAtLeast(1)
        val cy=cos(yaw);val sy=sin(yaw);val cx=cos(pitch);val sx=sin(pitch);val cz=cos(-.14);val sz=sin(-.14)
        fun rotate(v:V):V {
            val x=cy*v.x+sy*v.z;val z=-sy*v.x+cy*v.z
            val y=cx*v.y-sx*z;val rz=sx*v.y+cx*z
            return V(cz*x-sz*y,sz*x+cz*y,rz)
        }
        val distance=max(6.3,3.7/max(.6,w.toDouble()/h))+(if(exploded).6 else 0.0)
        val camera=V(0.0,0.0,distance)
        val focal=h/(2*tan(Math.toRadians(19.0)))
        val triangles=ArrayList<Triangle>(faces.size)
        for((index,face) in faces.withIndex()){
            if(index%256==0)coroutineContext.ensureActive()
            val offset=if(exploded)when(face.material.group){"left_cover"->V(-.56,0.0,0.0);"right_cover"->V(.56,0.0,0.0);else->V(0.0,0.0,0.0)}else V(0.0,0.0,0.0)
            val a=rotate(face.a+offset);val b=rotate(face.b+offset);val c=rotate(face.c+offset)
            val midpoint=(a+b+c)*(1.0/3)
            val normal=rotate(face.normal)
            val view=(camera-midpoint).unit()
            if(normal.dot(view)<=0)continue
            val key=(V(-3.0,4.0,5.0)-midpoint).unit()
            val fill=(V(4.0,1.0,2.0)-midpoint).unit()
            val light=.37+.57*max(0.0,normal.dot(key))+.19*max(0.0,normal.dot(fill))
            val spec=max(0.0,normal.dot((key+view).unit())).pow(28+57*face.material.metal)
            val fresnel=(1-max(0.0,normal.dot(view))).pow(4)
            val specColors=doubleArrayOf(.80,.85,.92);val edgeColors=doubleArrayOf(.018,.023,.032)
            val rgb=IntArray(3){k->
                val linear=face.material.linear[k]*light+specColors[k]*spec*(.07+.39*face.material.metal)+edgeColors[k]*fresnel
                (linear.coerceAtLeast(0.0).pow(1/2.2)*255).roundToInt().coerceIn(0,255)
            }
            val alpha=if(exploded&&face.material.group=="ring_base")31 else 255
            val points=FloatArray(6)
            val depths=FloatArray(3)
            for((j,v) in arrayOf(a,b,c).withIndex()){
                points[j*2]=(w*.5+focal*v.x/(distance-v.z)).toFloat()
                points[j*2+1]=(h*.5-focal*v.y/(distance-v.z)).toFloat()
                depths[j]=(1/(distance-v.z)).toFloat()
            }
            triangles+=Triangle(points,depths,midpoint.z,Color.argb(alpha,rgb[0],rgb[1],rgb[2]))
        }
        triangles.sortBy{it.depth}
        coroutineContext.ensureActive()
        val pixels=IntArray(w*h);val zBuffer=FloatArray(w*h)
        // A depth buffer gives solid walls without gaps between CAD triangles.
        for(transparent in listOf(false,true))for((index,t) in triangles.withIndex()){
            if(index%64==0)coroutineContext.ensureActive()
            if((Color.alpha(t.color)<255)!=transparent)continue
            val p=t.points
            val denominator=(p[3]-p[5])*(p[0]-p[4])+(p[4]-p[2])*(p[1]-p[5])
            if(abs(denominator)<1e-7f)continue
            val x0=floor(minOf(p[0],p[2],p[4])).toInt().coerceAtLeast(0)
            val x1=ceil(maxOf(p[0],p[2],p[4])).toInt().coerceAtMost(w-1)
            val y0=floor(minOf(p[1],p[3],p[5])).toInt().coerceAtLeast(0)
            val y1=ceil(maxOf(p[1],p[3],p[5])).toInt().coerceAtMost(h-1)
            val step0=(p[3]-p[5])/denominator;val step1=(p[5]-p[1])/denominator
            for(y in y0..y1){
                var a=((p[3]-p[5])*(x0+.5f-p[4])+(p[4]-p[2])*(y+.5f-p[5]))/denominator
                var b=((p[5]-p[1])*(x0+.5f-p[4])+(p[0]-p[4])*(y+.5f-p[5]))/denominator
                for(x in x0..x1){
                    val c=1-a-b
                    if(a>=-1e-6f&&b>=-1e-6f&&c>=-1e-6f){
                        val z=a*t.inverseDepth[0]+b*t.inverseDepth[1]+c*t.inverseDepth[2]
                        val pixel=y*w+x
                        if(z>zBuffer[pixel]){
                            if(transparent)pixels[pixel]=blend(t.color,pixels[pixel])
                            else {pixels[pixel]=t.color;zBuffer[pixel]=z}
                        }
                    }
                    a+=step0;b+=step1
                }
            }
        }
        coroutineContext.ensureActive()
        return Bitmap.createBitmap(pixels,w,h,Bitmap.Config.ARGB_8888)
    }
    private fun blend(front:Int,back:Int):Int {
        val f=Color.alpha(front)/255.0;val b=Color.alpha(back)/255.0
        val a=f+b*(1-f)
        fun channel(x:Int,y:Int)=((x*f+y*b*(1-f))/a).roundToInt().coerceIn(0,255)
        return Color.argb((a*255).roundToInt(),channel(Color.red(front),Color.red(back)),channel(Color.green(front),Color.green(back)),channel(Color.blue(front),Color.blue(back)))
    }
}
