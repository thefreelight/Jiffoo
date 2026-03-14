/**
 * Bulk Import Dialog Component
 *
 * Provides CSV import functionality with file upload, validation preview,
 * and detailed import results.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useT } from 'shared/src/i18n/react'
import { inventoryApi } from '@/lib/api/inventory'
import { Upload, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react'
import type { ImportInventoryResult } from 'shared'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: () => void
}

export function BulkImportDialog({ open, onOpenChange, onImportComplete }: BulkImportDialogProps) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [preview, setPreview] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportInventoryResult | null>(null)

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)

      // Read file content
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setCsvContent(content)

        // Generate preview (first 5 lines)
        const lines = content.split('\n').filter(line => line.trim())
        setPreview(lines.slice(0, 5))
      }
      reader.readAsText(selectedFile)
    }
  }

  const handleImport = async () => {
    if (!csvContent) return

    try {
      setImporting(true)
      const response = await inventoryApi.importCSV(csvContent)

      if (response.success && response.data) {
        setResult(response.data)

        // If import was successful, notify parent
        if (response.data.success && response.data.successfulUpdates > 0) {
          onImportComplete?.()
        }
      }
    } catch (error) {
      setResult({
        success: false,
        processedRows: 0,
        successfulUpdates: 0,
        failedUpdates: 0,
        errors: [{
          row: 0,
          field: 'general',
          message: getText('merchant.inventory.import.error', 'Failed to import inventory')
        }]
      })
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setCsvContent('')
    setPreview([])
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{getText('merchant.inventory.import.title', 'Import Inventory')}</DialogTitle>
          <DialogDescription>
            {getText('merchant.inventory.import.description', 'Upload a CSV file to bulk update inventory levels.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instructions */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-200">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">
                {getText('merchant.inventory.import.formatTitle', 'CSV Format')}
              </p>
              <p className="text-xs">
                {getText('merchant.inventory.import.formatDesc', 'Required columns: warehouseId, variantId, quantity. Optional: lowStock')}
              </p>
            </div>
          </div>

          {/* File Upload */}
          {!result && (
            <div className="space-y-2">
              <Label htmlFor="csv-file">
                {getText('merchant.inventory.import.selectFile', 'Select CSV File')}
              </Label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="csv-file"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {file ? file.name : getText('merchant.inventory.import.chooseFile', 'Choose a CSV file or drag it here')}
                  </span>
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <Label>{getText('merchant.inventory.import.preview', 'Preview (First 5 rows)')}</Label>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                  <pre className="text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {preview.join('\n')}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Import Results */}
          {result && (
            <div className="space-y-3">
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${
                result.success
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                {result.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium mb-1">
                    {result.success
                      ? getText('merchant.inventory.import.success', 'Import Completed')
                      : getText('merchant.inventory.import.failed', 'Import Failed')
                    }
                  </p>
                  <div className="text-xs space-y-1">
                    <p>{getText('merchant.inventory.import.processed', 'Processed rows')}: {result.processedRows}</p>
                    <p>{getText('merchant.inventory.import.successful', 'Successful updates')}: {result.successfulUpdates}</p>
                    <p>{getText('merchant.inventory.import.failed', 'Failed updates')}: {result.failedUpdates}</p>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-red-800">
                    {getText('merchant.inventory.import.errors', 'Errors')}
                  </Label>
                  <div className="bg-red-50 rounded-md p-3 border border-red-200 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      {result.errors.map((error, index) => (
                        <div key={index} className="text-xs text-red-700">
                          <span className="font-medium">Row {error.row}</span>
                          {error.field && <span className="text-red-600"> ({error.field})</span>}
                          : {error.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? getText('common.close', 'Close') : getText('common.cancel', 'Cancel')}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing
                ? getText('common.processing', 'Processing...')
                : getText('merchant.inventory.import.start', 'Import')
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
