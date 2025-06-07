'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

export default function TestConfigPage() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadProviders = async () => {
      try {
        console.log('Loading providers...')
        const response = await apiClient.getAuthProviders()
        console.log('Response:', response)
        
        if (response.success && response.data) {
          setProviders(response.data)
        } else {
          setError('Failed to load providers')
        }
      } catch (err) {
        console.error('Error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadProviders()
  }, [])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Test Config Page</h1>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Auth Providers:</h2>
        {providers.length > 0 ? (
          <ul className="space-y-2">
            {providers.map((provider) => (
              <li key={provider.id} className="p-3 border rounded">
                <div className="font-medium">{provider.name}</div>
                <div className="text-sm text-gray-600">
                  ID: {provider.id} | Version: {provider.version} | 
                  Configured: {provider.isConfigured ? 'Yes' : 'No'} | 
                  Licensed: {provider.isLicensed ? 'Yes' : 'No'}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No providers found</p>
        )}
      </div>
    </div>
  )
}
