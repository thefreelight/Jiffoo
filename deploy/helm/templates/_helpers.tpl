{{/*
Expand the name of the chart.
*/}}
{{- define "jiffoo-mall-core.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "jiffoo-mall-core.fullname" -}}
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
{{- define "jiffoo-mall-core.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "jiffoo-mall-core.labels" -}}
helm.sh/chart: {{ include "jiffoo-mall-core.chart" . }}
{{ include "jiffoo-mall-core.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "jiffoo-mall-core.selectorLabels" -}}
app.kubernetes.io/name: {{ include "jiffoo-mall-core.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service labels for a specific service
*/}}
{{- define "jiffoo-mall-core.serviceLabels" -}}
{{ include "jiffoo-mall-core.labels" . }}
app.kubernetes.io/component: {{ .serviceName }}
{{- end }}

{{/*
Service selector labels for a specific service
*/}}
{{- define "jiffoo-mall-core.serviceSelectorLabels" -}}
{{ include "jiffoo-mall-core.selectorLabels" . }}
app.kubernetes.io/component: {{ .serviceName }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "jiffoo-mall-core.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "jiffoo-mall-core.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate image name for a service
*/}}
{{- define "jiffoo-mall-core.image" -}}
{{- printf "%s/%s/%s:%s" .Values.global.image.registry .Values.global.image.repository .serviceName .Values.global.image.tag }}
{{- end }}

{{/*
Generate NodePort for a service (map service port to 30001-30009 range)
*/}}
{{- define "jiffoo-mall-core.nodePort" -}}
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
