/**
 * Kubernetes相关类型定义
 */

// Kubernetes资源基础接口
export interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
  status?: any;
  data?: any; // 用于ConfigMap
  type?: string; // 用于Secret
}

// 插件部署配置
export interface PluginDeploymentConfig {
  // 镜像配置
  image: string;
  imageTag?: string;
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  imagePullSecrets?: string[];

  // 副本配置
  replicas?: number;
  
  // 端口配置
  port?: number;
  
  // 资源配置
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };

  // 环境变量
  env?: Record<string, string>;
  
  // 配置文件
  config?: Record<string, any>;
  
  // 密钥
  secrets?: Record<string, string>;
  
  // 存储配置
  storage?: {
    enabled: boolean;
    size?: string;
    storageClass?: string;
    accessModes?: string[];
    mountPath?: string;
  };
  
  // Ingress配置
  ingress?: {
    enabled: boolean;
    host?: string;
    path?: string;
    tls?: boolean;
    annotations?: Record<string, string>;
  };
  
  // 健康检查配置
  healthCheck?: {
    enabled: boolean;
    path?: string;
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
    failureThreshold?: number;
  };
  
  // 安全配置
  security?: {
    runAsUser?: number;
    runAsGroup?: number;
    fsGroup?: number;
    runAsNonRoot?: boolean;
    readOnlyRootFilesystem?: boolean;
  };
  
  // 网络策略
  networkPolicy?: {
    enabled: boolean;
    ingress?: NetworkPolicyRule[];
    egress?: NetworkPolicyRule[];
  };
  
  // 服务账户
  serviceAccount?: {
    create: boolean;
    name?: string;
    annotations?: Record<string, string>;
  };
  
  // 节点选择器
  nodeSelector?: Record<string, string>;
  
  // 容忍度
  tolerations?: Toleration[];
  
  // 亲和性
  affinity?: Affinity;
  
  // 自动扩缩容
  autoscaling?: {
    enabled: boolean;
    minReplicas?: number;
    maxReplicas?: number;
    targetCPUUtilizationPercentage?: number;
    targetMemoryUtilizationPercentage?: number;
  };
}

// 网络策略规则
export interface NetworkPolicyRule {
  from?: NetworkPolicyPeer[];
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface NetworkPolicyPeer {
  podSelector?: LabelSelector;
  namespaceSelector?: LabelSelector;
  ipBlock?: {
    cidr: string;
    except?: string[];
  };
}

export interface NetworkPolicyPort {
  protocol?: 'TCP' | 'UDP' | 'SCTP';
  port?: number | string;
  endPort?: number;
}

// 标签选择器
export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

export interface LabelSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
  values?: string[];
}

// 容忍度
export interface Toleration {
  key?: string;
  operator?: 'Exists' | 'Equal';
  value?: string;
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  tolerationSeconds?: number;
}

// 亲和性
export interface Affinity {
  nodeAffinity?: NodeAffinity;
  podAffinity?: PodAffinity;
  podAntiAffinity?: PodAntiAffinity;
}

export interface NodeAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector;
  preferredDuringSchedulingIgnoredDuringExecution?: PreferredSchedulingTerm[];
}

export interface NodeSelector {
  nodeSelectorTerms: NodeSelectorTerm[];
}

export interface NodeSelectorTerm {
  matchExpressions?: NodeSelectorRequirement[];
  matchFields?: NodeSelectorRequirement[];
}

export interface NodeSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
  values?: string[];
}

export interface PreferredSchedulingTerm {
  weight: number;
  preference: NodeSelectorTerm;
}

export interface PodAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

export interface PodAntiAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
  preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}

export interface PodAffinityTerm {
  labelSelector?: LabelSelector;
  namespaces?: string[];
  topologyKey: string;
}

export interface WeightedPodAffinityTerm {
  weight: number;
  podAffinityTerm: PodAffinityTerm;
}

// 插件K8s状态
export interface PluginK8sStatus {
  pluginId: string;
  deployment: {
    name: string;
    namespace: string;
    replicas: number;
    readyReplicas: number;
    availableReplicas: number;
    conditions: DeploymentCondition[];
  };
  service: {
    name: string;
    type: string;
    clusterIP: string;
    ports: ServicePort[];
  };
  pods: PodStatus[];
}

export interface DeploymentCondition {
  type: string;
  status: string;
  lastUpdateTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ServicePort {
  name?: string;
  protocol: string;
  port: number;
  targetPort: number | string;
  nodePort?: number;
}

export interface PodStatus {
  name: string;
  phase: string;
  ready: boolean;
  restartCount: number;
  startTime?: string;
  nodeName: string;
}

// Helm相关类型
export interface HelmChart {
  name: string;
  version: string;
  repository?: string;
  values?: Record<string, any>;
}

export interface HelmRelease {
  name: string;
  namespace: string;
  revision: number;
  updated: string;
  status: string;
  chart: string;
  appVersion: string;
}

// 插件部署事件
export interface PluginDeploymentEvent {
  type: 'DEPLOYING' | 'DEPLOYED' | 'UPDATING' | 'UPDATED' | 'SCALING' | 'SCALED' | 'UNDEPLOYING' | 'UNDEPLOYED' | 'FAILED';
  pluginId: string;
  timestamp: Date;
  message?: string;
  details?: any;
}

// 插件监控指标
export interface PluginMetrics {
  pluginId: string;
  timestamp: Date;
  cpu: {
    usage: number;
    limit: number;
    percentage: number;
  };
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  requests: {
    total: number;
    success: number;
    errors: number;
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

// Kubernetes集群信息
export interface ClusterInfo {
  version: string;
  nodes: NodeInfo[];
  namespaces: string[];
  storageClasses: string[];
  ingressClasses: string[];
}

export interface NodeInfo {
  name: string;
  status: string;
  roles: string[];
  age: string;
  version: string;
  internalIP: string;
  externalIP?: string;
  os: string;
  kernel: string;
  containerRuntime: string;
  capacity: {
    cpu: string;
    memory: string;
    storage: string;
    pods: string;
  };
  allocatable: {
    cpu: string;
    memory: string;
    storage: string;
    pods: string;
  };
}

// 插件部署选项
export interface PluginDeploymentOptions {
  dryRun?: boolean;
  force?: boolean;
  timeout?: number;
  wait?: boolean;
  waitForJobs?: boolean;
  createNamespace?: boolean;
  skipCRDs?: boolean;
  disableHooks?: boolean;
  atomic?: boolean;
  cleanupOnFail?: boolean;
}

// 插件卸载选项
export interface PluginUndeploymentOptions {
  dryRun?: boolean;
  force?: boolean;
  timeout?: number;
  keepHistory?: boolean;
  cascade?: 'background' | 'foreground' | 'orphan';
  gracePeriod?: number;
}
