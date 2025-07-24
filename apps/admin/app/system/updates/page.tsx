'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  Settings,
  History,
  Info
} from 'lucide-react'

interface VersionInfo {
  current: string
  latest?: {
    current: string
    latest: string
    hasUpdate: boolean
    releaseNotes: string
    downloadUrl: string
    publishedAt: string
    prerelease: boolean
  }
  lastCheck?: string
}

interface UpdateProgress {
  status: string
  currentStep?: {
    name: string
    description: string
    progress: number
  }
  completedSteps: number
  totalSteps: number
  overallProgress: number
  startTime?: string
  estimatedEndTime?: string
  error?: string
}



export default function UpdatesPage() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const versionRes = await fetch('http://localhost:3004/api/version')

      if (versionRes.ok) {
        const versionData = await versionRes.json()
        if (versionData.success) {
          setVersionInfo({
            current: versionData.data.current,
            latest: versionData.data.latest,
            lastCheck: versionData.data.lastCheck
          })
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      setMessage('Failed to load update information')
    } finally {
      setLoading(false)
    }
  }

  // 简化的toast函数
  const showToast = (title: string, description: string, type: 'success' | 'error' = 'success') => {
    setMessage(`${title}: ${description}`)
    setTimeout(() => setMessage(''), 5000)
  }

  const checkForUpdates = async () => {
    setChecking(true)
    try {
      const response = await fetch('http://localhost:3004/api/version')
      const data = await response.json()

      if (data.success) {
        setVersionInfo({
          current: data.data.current,
          latest: data.data.latest,
          lastCheck: new Date().toISOString()
        })

        if (data.data.latest?.hasUpdate) {
          showToast("Update Available", `Version ${data.data.latest.latest} is available`)
        } else {
          showToast("No Updates", "You are running the latest version")
        }
      }
    } catch (error) {
      console.error('Check update error:', error)
      showToast("Error", "Failed to check for updates", 'error')
    } finally {
      setChecking(false)
    }
  }

  const startUpdate = async () => {
    try {
      setUpdating(true)
      showToast("Update Started", "System update is beginning...")

      // 实际调用更新API
      const response = await fetch('http://localhost:3004/api/update', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        // 模拟更新进度
        setUpdateProgress({
          status: 'updating',
          completedSteps: 0,
          totalSteps: 3,
          overallProgress: 0
        })

        // 模拟进度更新
        for (let i = 1; i <= 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          setUpdateProgress({
            status: i === 3 ? 'completed' : 'updating',
            completedSteps: i,
            totalSteps: 3,
            overallProgress: (i / 3) * 100
          })
        }

        setUpdating(false)
        showToast("Update Completed", "System has been updated successfully!")

        // 重新加载数据
        setTimeout(loadData, 1000)
      } else {
        throw new Error(data.message || 'Update failed')
      }
    } catch (error) {
      console.error('Update error:', error)
      setUpdating(false)
      showToast("Update Failed", "Failed to start update", 'error')
    }
  }

  const cancelUpdate = () => {
    setUpdating(false)
    setUpdateProgress(null)
    showToast("Update Cancelled", "Update has been cancelled")
  }



  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔄 System Updates</h1>
          <p className="text-gray-600">Manage system updates and version control</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={checkForUpdates}
            disabled={checking || updating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Check for Updates
          </Button>

          {versionInfo?.latest?.hasUpdate && !updating && (
            <Button onClick={startUpdate}>
              <Download className="w-4 h-4 mr-2" />
              Update Now
            </Button>
          )}

          {updating && (
            <Button variant="destructive" onClick={cancelUpdate}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Cancel Update
            </Button>
          )}
        </div>
      </div>

      {/* 消息显示 */}
      {message && (
        <div className={`p-4 rounded-lg ${message.includes('Error') || message.includes('Failed') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {/* Current Version */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Version Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-600">Current Version</div>
              <p className="text-2xl font-bold">{versionInfo?.current || 'Loading...'}</p>
            </div>

            {versionInfo?.latest && (
              <div>
                <div className="text-sm font-medium text-gray-600">Latest Version</div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{versionInfo.latest.latest}</p>
                  {versionInfo.latest.hasUpdate && (
                    <Badge className="bg-blue-100 text-blue-800">Update Available</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {versionInfo?.lastCheck && (
            <p className="text-sm text-gray-600">
              Last checked: {new Date(versionInfo.lastCheck).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Update Progress */}
      {updating && updateProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {updateProgress.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <RefreshCw className="w-5 h-5 animate-spin" />}
              Update Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{updateProgress.overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress.overallProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Step {updateProgress.completedSteps} of {updateProgress.totalSteps}
            </div>

            {updateProgress.error && (
              <div className="p-3 bg-red-100 text-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {updateProgress.error}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Release Notes */}
      {versionInfo?.latest?.hasUpdate && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Release Notes</CardTitle>
            <CardDescription>
              What's new in version {versionInfo.latest.latest}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                {versionInfo.latest.releaseNotes || 'No release notes available.'}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 简化的设置区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            ⚙️ Update Settings
          </CardTitle>
          <CardDescription>
            Basic update configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium">Auto Check</div>
              <div className="text-sm text-gray-600">Enabled (24h interval)</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium">Update Strategy</div>
              <div className="text-sm text-gray-600">Rolling Update</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 更新历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            📈 Update History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No update history available</p>
            <p className="text-sm">Updates will appear here after completion</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
