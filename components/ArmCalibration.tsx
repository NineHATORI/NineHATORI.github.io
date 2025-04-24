'use client'

import { useEffect, useRef, useState } from 'react'
import { Pose, POSE_CONNECTIONS, Results } from '@mediapipe/pose'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import * as cam from '@mediapipe/camera_utils'

export default function ArmCalibration() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [angle, setAngle] = useState<number | null>(null)
  const [baseline, setBaseline] = useState<number | null>(null)
  const [status, setStatus] = useState('Calibrating...')
  const [startTime, setStartTime] = useState<number | null>(null)
  const holdTime = 3
  const tolerance = 5

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    })

    pose.onResults(onResults)

    const camera = new cam.Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current! })
      },
      width: 640,
      height: 480,
    })
    camera.start()
  }, [])

  const calculateAngle = (a: any, b: any, c: any) => {
    const ba = [a.x - b.x, a.y - b.y]
    const bc = [c.x - b.x, c.y - b.y]
    const dot = ba[0] * bc[0] + ba[1] * bc[1]
    const magBA = Math.sqrt(ba[0] ** 2 + ba[1] ** 2)
    const magBC = Math.sqrt(bc[0] ** 2 + bc[1] ** 2)
    const cosine = dot / (magBA * magBC + 1e-6)
    return Math.round(Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI))
  }

  const onResults = (results: Results) => {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.save()
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    ctx.drawImage(results.image, 0, 0, canvasRef.current!.width, canvasRef.current!.height)

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00' })
      drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', radius: 4 })

      const s = results.poseLandmarks[11]
      const e = results.poseLandmarks[13]
      const w = results.poseLandmarks[15]
      const a = calculateAngle(s, e, w)
      setAngle(a)

      if (baseline == null) {
        const withinRange = Math.abs(a - 180) <= tolerance
        if (withinRange) {
          if (startTime == null) setStartTime(Date.now())
          else if ((Date.now() - startTime) / 1000 >= holdTime) {
            setBaseline(a)
            setStatus('Calibrated ✔️')
          }
        } else {
          setStartTime(null)
        }
      } else {
        const diff = Math.abs(a - baseline)
        const armStatus = diff <= tolerance ? 'Arm Straight ✅' : 'Arm Bent ❌'
        setStatus(armStatus)
      }

      ctx.font = '20px Arial'
      ctx.fillStyle = 'white'
      ctx.fillText(`Angle: ${a}°`, 10, 30)
      ctx.fillText(status, 10, 60)
    }

    ctx.restore()
  }

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ border: '1px solid #ccc' }} />
    </div>
  )
}
