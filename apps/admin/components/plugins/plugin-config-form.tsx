'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Save, 
  TestTube, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Info,
  Copy,
  RefreshCw
} from 'lucide-react';

interface ConfigField {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  sensitive?: boolean;
  default?: any;
  enum?: string[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

interface ConfigSchema {
  type: string;
  properties: Record<string, ConfigField>;
  required: string[];
  additionalProperties: boolean;
}

interface ValidationError {
  field: string;
  message: string;
}

interface PluginConfigFormProps {
  pluginId: string;
  pluginName: string;
  schema: ConfigSchema;
  currentConfig?: Record<string, any>;
  onSave: (config: Record<string, any>) => Promise<void>;
  onTest?: (config: Record<string, any>) => Promise<boolean>;
}

export default function PluginConfigForm({
  pluginId,
  pluginName,
  schema,
  currentConfig = {},
  onSave,
  onTest
}: PluginConfigFormProps) {
  const [config, setConfig] = useState<Record<string, any>>(currentConfig);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Initialize config with default values
    const initialConfig = { ...currentConfig };
    Object.entries(schema.properties).forEach(([key, field]) => {
      if (!(key in initialConfig) && field.default !== undefined) {
        initialConfig[key] = field.default;
      }
    });
    setConfig(initialConfig);
  }, [schema, currentConfig]);

  const validateField = (name: string, value: any): string | null => {
    const field = schema.properties[name];
    if (!field) return null;

    // Required field validation
    if (schema.required.includes(name) && (!value || value === '')) {
      return `${name} is required`;
    }

    if (!value) return null; // Skip validation for empty optional fields

    // Type validation
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') return `${name} must be a string`;
        
        // Pattern validation
        if (field.pattern && !new RegExp(field.pattern).test(value)) {
          return `${name} format is invalid`;
        }
        
        // Length validation
        if (field.minLength && value.length < field.minLength) {
          return `${name} must be at least ${field.minLength} characters`;
        }
        if (field.maxLength && value.length > field.maxLength) {
          return `${name} must be no more than ${field.maxLength} characters`;
        }
        
        // Enum validation
        if (field.enum && !field.enum.includes(value)) {
          return `${name} must be one of: ${field.enum.join(', ')}`;
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) return `${name} must be a number`;
        
        if (field.minimum !== undefined && numValue < field.minimum) {
          return `${name} must be at least ${field.minimum}`;
        }
        if (field.maximum !== undefined && numValue > field.maximum) {
          return `${name} must be no more than ${field.maximum}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') return `${name} must be true or false`;
        break;
    }

    return null;
  };

  const validateConfig = (): ValidationError[] => {
    const validationErrors: ValidationError[] = [];
    
    Object.entries(schema.properties).forEach(([name, field]) => {
      const error = validateField(name, config[name]);
      if (error) {
        validationErrors.push({ field: name, message: error });
      }
    });

    return validationErrors;
  };

  const handleFieldChange = (name: string, value: any) => {
    setConfig(prev => ({ ...prev, [name]: value }));
    
    // Clear field-specific errors
    setErrors(prev => prev.filter(error => error.field !== name));
    
    // Validate the field
    const error = validateField(name, value);
    if (error) {
      setErrors(prev => [...prev, { field: name, message: error }]);
    }
  };

  const handleSave = async () => {
    const validationErrors = validateConfig();
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    setSaving(true);
    try {
      await onSave(config);
      setTestResult({ success: true, message: 'Configuration saved successfully!' });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to save configuration' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;

    const validationErrors = validateConfig();
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    setTesting(true);
    try {
      const success = await onTest(config);
      setTestResult({ 
        success, 
        message: success ? 'Configuration test passed!' : 'Configuration test failed' 
      });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Test failed' 
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleSensitiveVisibility = (fieldName: string) => {
    setShowSensitive(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  const renderField = (name: string, field: ConfigField) => {
    const value = config[name] || '';
    const fieldErrors = errors.filter(error => error.field === name);
    const hasError = fieldErrors.length > 0;

    const baseProps = {
      id: name,
      value: value,
      onChange: (e: any) => handleFieldChange(name, e.target.value),
      className: hasError ? 'border-red-500' : '',
    };

    return (
      <div key={name} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={name} className="text-sm font-medium">
            {name}
          </Label>
          {schema.required.includes(name) && (
            <Badge variant="destructive" className="text-xs">Required</Badge>
          )}
          {field.sensitive && (
            <Badge variant="secondary" className="text-xs">Sensitive</Badge>
          )}
        </div>

        {field.description && (
          <p className="text-xs text-gray-600">{field.description}</p>
        )}

        <div className="relative">
          {field.type === 'boolean' ? (
            <div className="flex items-center space-x-2">
              <Switch
                id={name}
                checked={Boolean(value)}
                onCheckedChange={(checked) => handleFieldChange(name, checked)}
              />
              <Label htmlFor={name} className="text-sm">
                {value ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          ) : field.enum ? (
            <select
              {...baseProps}
              onChange={(e) => handleFieldChange(name, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select {name}</option>
              {field.enum.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === 'string' && field.maxLength && field.maxLength > 100 ? (
            <Textarea
              {...baseProps}
              placeholder={`Enter ${name}`}
              rows={3}
            />
          ) : (
            <div className="relative">
              <Input
                {...baseProps}
                type={field.sensitive && !showSensitive[name] ? 'password' : 'text'}
                placeholder={`Enter ${name}`}
              />
              
              {field.sensitive && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSensitiveVisibility(name)}
                    className="p-1 h-auto"
                  >
                    {showSensitive[name] ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                  
                  {value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(value)}
                      className="p-1 h-auto"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {fieldErrors.map((error, index) => (
          <div key={index} className="flex items-center gap-1 text-red-600 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{error.message}</span>
          </div>
        ))}

        {field.pattern && (
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Info className="w-3 h-3" />
            <span>Format: {field.pattern}</span>
          </div>
        )}
      </div>
    );
  };

  const requiredFields = Object.entries(schema.properties).filter(([name]) => 
    schema.required.includes(name)
  );
  
  const optionalFields = Object.entries(schema.properties).filter(([name]) => 
    !schema.required.includes(name)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Configure {pluginName}
          </CardTitle>
          <CardDescription>
            Configure the plugin settings below. Required fields must be filled before saving.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Test Result Alert */}
          {testResult && (
            <Alert className={testResult.success ? 'border-green-500' : 'border-red-500'}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                  {testResult.message}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Required Fields */}
          {requiredFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Required Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requiredFields.map(([name, field]) => renderField(name, field))}
              </div>
            </div>
          )}

          {/* Optional Fields */}
          {optionalFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Optional Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {optionalFields.map(([name, field]) => renderField(name, field))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {errors.length > 0 && (
                <span className="text-red-600">
                  {errors.length} validation error{errors.length > 1 ? 's' : ''} found
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              {onTest && (
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || saving || errors.length > 0}
                  className="flex items-center gap-2"
                >
                  {testing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                  Test Configuration
                </Button>
              )}
              
              <Button
                onClick={handleSave}
                disabled={saving || testing || errors.length > 0}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Configuration
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
