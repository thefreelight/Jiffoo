{{/*
Expand the name of the chart.
*/}}
{{- define "jiffoo.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "jiffoo.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "jiffoo.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "jiffoo.labels" -}}
helm.sh/chart: {{ include "jiffoo.chart" . }}
{{ include "jiffoo.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "jiffoo.selectorLabels" -}}
app.kubernetes.io/name: {{ include "jiffoo.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service labels for a specific service
*/}}
{{- define "jiffoo.serviceLabels" -}}
{{ include "jiffoo.labels" . }}
app.kubernetes.io/component: {{ .serviceName }}
{{- end }}

{{/*
Service selector labels for a specific service
*/}}
{{- define "jiffoo.serviceSelectorLabels" -}}
{{ include "jiffoo.selectorLabels" . }}
app.kubernetes.io/component: {{ .serviceName }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "jiffoo.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "jiffoo.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate image name for a service
*/}}
{{- define "jiffoo.image" -}}
{{- printf "%s/%s/%s:%s" .Values.global.image.registry .Values.global.image.repository .serviceName .Values.global.image.tag }}
{{- end }}

{{/*
Generate NodePort for a service (map service port to 30001-30009 range)
*/}}
{{- define "jiffoo.nodePort" -}}
{{- $port := .port | int }}
{{- if eq $port 3001 }}30001{{- end }}
{{- if eq $port 3002 }}30002{{- end }}
{{- if eq $port 3003 }}30003{{- end }}
{{- if eq $port 3004 }}30004{{- end }}
{{- if eq $port 3005 }}30005{{- end }}
{{- if eq $port 3006 }}30006{{- end }}
{{- if eq $port 3007 }}30007{{- end }}
{{- if eq $port 3008 }}30008{{- end }}
{{- if eq $port 3009 }}30009{{- end }}
{{- end }}
