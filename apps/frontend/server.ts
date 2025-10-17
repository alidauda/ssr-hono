import { Hono } from 'hono'
import { render as RenderType } from './src/entry-server';
import { fromNodeMiddleware } from '@hono/node-server'
import { compress } from 'hono/compress'
import { serveStatic } from '@hono/node-server/serve-static'
import type {ViteDevServer} from "vite"
import { stream, streamText, streamSSE } from 'hono/streaming'

const isProduction = process.env.NODE_ENV === 'production'
const port = process.env.PORT || 5173
const base = process.env.BASE || '/'
const ABORT_DELAY = 10000
const templateHtml = isProduction
  ?await Bun.file('./dist/client/index.html').text()
  : ''
const app =new Hono()

let vite:ViteDevServer

if(!isProduction){
    const { createServer } = await import('vite')
    vite=await createServer({
      server:{middlewareMode:true},
      appType:'custom',
      base
    })
    app.use(fromNodeMiddleware(vite.middlewares))
}else{
  app.use(compress())
  app.use(base,serveStatic({ root: './dist/client' }))
}

app.use("*all",async(c)=>{
  try{
    const url=c.req.url.replace(base,"")

     let template:string
     let render:typeof RenderType;
     if(isProduction){
       template=await Bun.file('./index.html').text()
       template = await vite.transformIndexHtml(url, template)
       render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render
     }else{
       template = templateHtml
       render = RenderType
     }
     let didError = false
      const { pipe, abort }=render(url,{
        onShellError(){
          c.status(500)
          c.header('Content-Type', 'text/html')
          c.html('<h1>Something went wrong</h1>')

        },
        onShellReady(){
          c.status(didError?500:200)
          c.header('Content-Type', 'text/html')
          const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`)
          let htmlEnded = false
          const transformStream=new TransformStream({
            transform(chunk,controller){
              if(!htmlEnded){
                chunk=chunk.toString()
                if(chunk.endsWith('<vite-streaming-end></vite-streaming-end>')){
                  controller.enqueue(chunk.slice(0,-41)+htmlEnd)

                }else{
                  controller.enqueue(chunk)
                }
              }else{
                controller.enqueue(chunk)
              }


            }


          })

          return stream(c, async (stream) => {
                stream.write(transformStream)
              })



        }
      })

  }catch(e){

  }
})
