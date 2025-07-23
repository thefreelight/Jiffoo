import { Logger } from '../utils/Logger';
import { PluginError, PluginInstance, PluginMetadata } from '../types/PluginTypes';
import {
  KubernetesResource,
  PluginDeploymentConfig,
  PluginK8sStatus,
  PluginDeploymentOptions,
  PluginUndeploymentOptions
} from '../types/KubernetesTypes';

/**
 * Kubernetes插件管理器
 * 负责插件在Kubernetes集群中的生命周期管理
 */
export class PluginK8sManager {
  private logger: Logger;
  private kubeconfig: string;
  private namespace: string;
  private helmBinary: string;

  constructor(config: {
    kubeconfig?: string;
    namespace?: string;
    helmBinary?: string;
  } = {}) {
    this.logger = new Logger('PluginK8sManager');
    this.kubeconfig = config.kubeconfig || process.env.KUBECONFIG || '~/.kube/config';
    this.namespace = config.namespace || 'jiffoo-plugins';
    this.helmBinary = config.helmBinary || 'helm';
  }

  /**
   * 部署插件到Kubernetes
   */
  public async deployPlugin(
    pluginId: string,
    metadata: PluginMetadata,
    config: PluginDeploymentConfig
  ): Promise<PluginInstance> {
    this.logger.info(`Deploying plugin: ${pluginId}`);

    try {
      // 1. 创建命名空间（如果不存在）
      await this.ensureNamespace(this.namespace);

      // 2. 生成Kubernetes资源
      const resources = await this.generateKubernetesResources(pluginId, metadata, config);

      // 3. 应用资源到集群
      await this.applyResources(resources);

      // 4. 等待部署完成
      await this.waitForDeployment(pluginId);

      // 5. 创建插件实例信息
      const instance = await this.createPluginInstance(pluginId, metadata, config);

      this.logger.info(`Plugin deployed successfully: ${pluginId}`);
      return instance;

    } catch (error) {
      this.logger.error(`Failed to deploy plugin: ${pluginId}`, error);
      
      // 清理失败的部署
      await this.cleanupFailedDeployment(pluginId);
      
      throw new PluginError(
        `Plugin deployment failed: ${pluginId}`,
        'DEPLOYMENT_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 卸载插件
   */
  public async undeployPlugin(pluginId: string): Promise<void> {
    this.logger.info(`Undeploying plugin: ${pluginId}`);

    try {
      // 1. 删除服务
      await this.deleteService(pluginId);

      // 2. 删除部署
      await this.deleteDeployment(pluginId);

      // 3. 删除配置映射
      await this.deleteConfigMap(pluginId);

      // 4. 删除密钥
      await this.deleteSecret(pluginId);

      // 5. 删除持久卷声明
      await this.deletePVC(pluginId);

      this.logger.info(`Plugin undeployed successfully: ${pluginId}`);

    } catch (error) {
      this.logger.error(`Failed to undeploy plugin: ${pluginId}`, error);
      throw new PluginError(
        `Plugin undeployment failed: ${pluginId}`,
        'UNDEPLOYMENT_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 更新插件部署
   */
  public async updatePlugin(
    pluginId: string,
    metadata: PluginMetadata,
    config: PluginDeploymentConfig
  ): Promise<PluginInstance> {
    this.logger.info(`Updating plugin: ${pluginId}`);

    try {
      // 1. 生成新的资源配置
      const resources = await this.generateKubernetesResources(pluginId, metadata, config);

      // 2. 应用更新
      await this.applyResources(resources);

      // 3. 等待滚动更新完成
      await this.waitForRollout(pluginId);

      // 4. 更新插件实例信息
      const instance = await this.createPluginInstance(pluginId, metadata, config);

      this.logger.info(`Plugin updated successfully: ${pluginId}`);
      return instance;

    } catch (error) {
      this.logger.error(`Failed to update plugin: ${pluginId}`, error);
      throw new PluginError(
        `Plugin update failed: ${pluginId}`,
        'UPDATE_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 扩缩容插件
   */
  public async scalePlugin(pluginId: string, replicas: number): Promise<void> {
    this.logger.info(`Scaling plugin ${pluginId} to ${replicas} replicas`);

    try {
      await this.executeKubectl([
        'scale',
        'deployment',
        `plugin-${pluginId}`,
        `--replicas=${replicas}`,
        '-n', this.namespace
      ]);

      // 等待扩缩容完成
      await this.waitForScale(pluginId, replicas);

      this.logger.info(`Plugin scaled successfully: ${pluginId} -> ${replicas} replicas`);

    } catch (error) {
      this.logger.error(`Failed to scale plugin: ${pluginId}`, error);
      throw new PluginError(
        `Plugin scaling failed: ${pluginId}`,
        'SCALING_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 获取插件状态
   */
  public async getPluginStatus(pluginId: string): Promise<PluginK8sStatus> {
    try {
      const deployment = await this.getDeployment(pluginId);
      const service = await this.getService(pluginId);
      const pods = await this.getPods(pluginId);

      return {
        pluginId,
        deployment: {
          name: deployment.metadata?.name || '',
          namespace: deployment.metadata?.namespace || '',
          replicas: deployment.spec?.replicas || 0,
          readyReplicas: deployment.status?.readyReplicas || 0,
          availableReplicas: deployment.status?.availableReplicas || 0,
          conditions: deployment.status?.conditions || []
        },
        service: {
          name: service.metadata?.name || '',
          type: service.spec?.type || '',
          clusterIP: service.spec?.clusterIP || '',
          ports: service.spec?.ports || []
        },
        pods: pods.map(pod => ({
          name: pod.metadata?.name || '',
          phase: pod.status?.phase || '',
          ready: this.isPodReady(pod),
          restartCount: this.getPodRestartCount(pod),
          startTime: pod.status?.startTime,
          nodeName: pod.spec?.nodeName || ''
        }))
      };

    } catch (error) {
      this.logger.error(`Failed to get plugin status: ${pluginId}`, error);
      throw new PluginError(
        `Failed to get plugin status: ${pluginId}`,
        'STATUS_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 获取插件日志
   */
  public async getPluginLogs(
    pluginId: string,
    options: {
      lines?: number;
      follow?: boolean;
      since?: string;
      container?: string;
    } = {}
  ): Promise<string> {
    try {
      const args = [
        'logs',
        '-l', `app=plugin-${pluginId}`,
        '-n', this.namespace
      ];

      if (options.lines) {
        args.push('--tail', options.lines.toString());
      }

      if (options.follow) {
        args.push('-f');
      }

      if (options.since) {
        args.push('--since', options.since);
      }

      if (options.container) {
        args.push('-c', options.container);
      }

      const result = await this.executeKubectl(args);
      return result.stdout;

    } catch (error) {
      this.logger.error(`Failed to get plugin logs: ${pluginId}`, error);
      throw new PluginError(
        `Failed to get plugin logs: ${pluginId}`,
        'LOGS_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 执行插件命令
   */
  public async execInPlugin(
    pluginId: string,
    command: string[],
    options: {
      container?: string;
      stdin?: boolean;
      tty?: boolean;
    } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      // 获取第一个可用的Pod
      const pods = await this.getPods(pluginId);
      if (pods.length === 0) {
        throw new Error('No pods found for plugin');
      }

      const podName = pods[0].metadata?.name;
      if (!podName) {
        throw new Error('Pod name not found');
      }

      const args = ['exec', podName, '-n', this.namespace];

      if (options.container) {
        args.push('-c', options.container);
      }

      if (options.stdin) {
        args.push('-i');
      }

      if (options.tty) {
        args.push('-t');
      }

      args.push('--', ...command);

      const result = await this.executeKubectl(args);
      return {
        stdout: result.stdout,
        stderr: result.stderr
      };

    } catch (error) {
      this.logger.error(`Failed to exec in plugin: ${pluginId}`, error);
      throw new PluginError(
        `Failed to exec in plugin: ${pluginId}`,
        'EXEC_FAILED',
        500,
        error
      );
    }
  }

  /**
   * 生成Kubernetes资源
   */
  private async generateKubernetesResources(
    pluginId: string,
    metadata: PluginMetadata,
    config: PluginDeploymentConfig
  ): Promise<KubernetesResource[]> {
    const resources: KubernetesResource[] = [];

    // 生成ConfigMap
    resources.push(this.generateConfigMap(pluginId, config));

    // 生成Secret
    resources.push(this.generateSecret(pluginId, config));

    // 生成Deployment
    resources.push(this.generateDeployment(pluginId, metadata, config));

    // 生成Service
    resources.push(this.generateService(pluginId, config));

    // 生成PVC（如果需要）
    if (config.storage?.enabled) {
      resources.push(this.generatePVC(pluginId, config));
    }

    // 生成Ingress（如果需要）
    if (config.ingress?.enabled) {
      resources.push(this.generateIngress(pluginId, config));
    }

    return resources;
  }

  /**
   * 生成Deployment资源
   */
  private generateDeployment(
    pluginId: string,
    metadata: PluginMetadata,
    config: PluginDeploymentConfig
  ): KubernetesResource {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `plugin-${pluginId}`,
        namespace: this.namespace,
        labels: {
          app: `plugin-${pluginId}`,
          'jiffoo.component': 'plugin',
          'jiffoo.plugin.name': metadata.name,
          'jiffoo.plugin.version': metadata.version,
          'jiffoo.plugin.type': metadata.type
        }
      },
      spec: {
        replicas: config.replicas || 1,
        selector: {
          matchLabels: {
            app: `plugin-${pluginId}`
          }
        },
        template: {
          metadata: {
            labels: {
              app: `plugin-${pluginId}`,
              'jiffoo.component': 'plugin',
              'jiffoo.plugin.name': metadata.name,
              'jiffoo.plugin.version': metadata.version
            },
            annotations: {
              'prometheus.io/scrape': 'true',
              'prometheus.io/port': config.port?.toString() || '3000',
              'prometheus.io/path': '/metrics'
            }
          },
          spec: {
            containers: [{
              name: 'plugin',
              image: config.image,
              ports: [{
                containerPort: config.port || 3000,
                name: 'http'
              }],
              env: this.generateEnvironmentVariables(pluginId, config),
              resources: {
                requests: {
                  cpu: metadata.resources?.cpu?.request || '100m',
                  memory: metadata.resources?.memory?.request || '128Mi'
                },
                limits: {
                  cpu: metadata.resources?.cpu?.limit || '500m',
                  memory: metadata.resources?.memory?.limit || '512Mi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 'http'
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 'http'
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 3
              },
              volumeMounts: this.generateVolumeMounts(pluginId, config)
            }],
            volumes: this.generateVolumes(pluginId, config),
            restartPolicy: 'Always',
            serviceAccountName: `plugin-${pluginId}`,
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1000,
              fsGroup: 1000
            }
          }
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxUnavailable: 1,
            maxSurge: 1
          }
        }
      }
    };
  }

  /**
   * 生成Service资源
   */
  private generateService(pluginId: string, config: PluginDeploymentConfig): KubernetesResource {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `plugin-${pluginId}`,
        namespace: this.namespace,
        labels: {
          app: `plugin-${pluginId}`,
          'jiffoo.component': 'plugin'
        }
      },
      spec: {
        selector: {
          app: `plugin-${pluginId}`
        },
        ports: [{
          name: 'http',
          port: 80,
          targetPort: config.port || 3000,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };
  }

  /**
   * 执行kubectl命令
   */
  private async executeKubectl(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', args, {
        env: {
          ...process.env,
          KUBECONFIG: this.kubeconfig
        }
      });

      let stdout = '';
      let stderr = '';

      kubectl.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      kubectl.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      kubectl.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`kubectl command failed with code ${code}: ${stderr}`));
        }
      });

      kubectl.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 执行kubectl命令并传入输入数据
   */
  private async executeKubectlWithInput(args: string[], input: string): Promise<{ stdout: string; stderr: string }> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', args, {
        env: {
          ...process.env,
          KUBECONFIG: this.kubeconfig
        }
      });

      let stdout = '';
      let stderr = '';

      kubectl.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      kubectl.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      kubectl.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`kubectl command failed with code ${code}: ${stderr}`));
        }
      });

      kubectl.on('error', (error) => {
        reject(error);
      });

      // 写入输入数据
      kubectl.stdin.write(input);
      kubectl.stdin.end();
    });
  }

  /**
   * 生成ConfigMap资源
   */
  private generateConfigMap(pluginId: string, config: PluginDeploymentConfig): KubernetesResource {
    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `plugin-${pluginId}-config`,
        namespace: this.namespace,
        labels: {
          app: `plugin-${pluginId}`,
          'jiffoo.component': 'plugin-config'
        }
      },
      data: {
        'config.json': JSON.stringify(config.config || {}),
        'plugin.env': this.generateEnvFile(config.env || {})
      }
    };
  }

  /**
   * 生成Secret资源
   */
  private generateSecret(pluginId: string, config: PluginDeploymentConfig): KubernetesResource {
    const secrets = config.secrets || {};
    const data: Record<string, string> = {};

    // Base64编码所有密钥
    for (const [key, value] of Object.entries(secrets)) {
      data[key] = Buffer.from(value).toString('base64');
    }

    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `plugin-${pluginId}-secret`,
        namespace: this.namespace,
        labels: {
          app: `plugin-${pluginId}`,
          'jiffoo.component': 'plugin-secret'
        }
      },
      type: 'Opaque',
      data
    };
  }

  /**
   * 生成PVC资源
   */
  private generatePVC(pluginId: string, config: PluginDeploymentConfig): KubernetesResource {
    const storage = config.storage!;

    return {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: `plugin-${pluginId}-storage`,
        namespace: this.namespace,
        labels: {
          app: `plugin-${pluginId}`,
          'jiffoo.component': 'plugin-storage'
        }
      },
      spec: {
        accessModes: storage.accessModes || ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: storage.size || '1Gi'
          }
        },
        storageClassName: storage.storageClass
      }
    };
  }

  /**
   * 生成Ingress资源
   */
  private generateIngress(pluginId: string, config: PluginDeploymentConfig): KubernetesResource {
    const ingress = config.ingress!;

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `plugin-${pluginId}-ingress`,
        namespace: this.namespace,
        labels: {
          app: `plugin-${pluginId}`,
          'jiffoo.component': 'plugin-ingress'
        },
        annotations: {
          'nginx.ingress.kubernetes.io/rewrite-target': '/',
          ...ingress.annotations
        }
      },
      spec: {
        rules: [{
          host: ingress.host,
          http: {
            paths: [{
              path: ingress.path || '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: `plugin-${pluginId}`,
                  port: {
                    number: 80
                  }
                }
              }
            }]
          }
        }],
        tls: ingress.tls ? [{
          hosts: [ingress.host!],
          secretName: `plugin-${pluginId}-tls`
        }] : undefined
      }
    };
  }

  /**
   * 生成环境变量
   */
  private generateEnvironmentVariables(pluginId: string, config: PluginDeploymentConfig): any[] {
    const env = [];

    // 基础环境变量
    env.push(
      { name: 'PLUGIN_ID', value: pluginId },
      { name: 'PLUGIN_NAMESPACE', value: this.namespace },
      { name: 'NODE_ENV', value: 'production' }
    );

    // 用户定义的环境变量
    for (const [key, value] of Object.entries(config.env || {})) {
      env.push({ name: key, value });
    }

    // 从ConfigMap引用
    env.push({
      name: 'CONFIG_PATH',
      value: '/etc/plugin/config.json'
    });

    // 从Secret引用
    if (config.secrets && Object.keys(config.secrets).length > 0) {
      for (const key of Object.keys(config.secrets)) {
        env.push({
          name: key.toUpperCase(),
          valueFrom: {
            secretKeyRef: {
              name: `plugin-${pluginId}-secret`,
              key
            }
          }
        });
      }
    }

    return env;
  }

  /**
   * 生成卷挂载
   */
  private generateVolumeMounts(pluginId: string, config: PluginDeploymentConfig): any[] {
    const mounts = [];

    // 配置文件挂载
    mounts.push({
      name: 'config',
      mountPath: '/etc/plugin',
      readOnly: true
    });

    // 存储挂载
    if (config.storage?.enabled) {
      mounts.push({
        name: 'storage',
        mountPath: config.storage.mountPath || '/data'
      });
    }

    return mounts;
  }

  /**
   * 生成卷
   */
  private generateVolumes(pluginId: string, config: PluginDeploymentConfig): any[] {
    const volumes = [];

    // 配置卷
    volumes.push({
      name: 'config',
      configMap: {
        name: `plugin-${pluginId}-config`
      }
    });

    // 存储卷
    if (config.storage?.enabled) {
      volumes.push({
        name: 'storage',
        persistentVolumeClaim: {
          claimName: `plugin-${pluginId}-storage`
        }
      });
    }

    return volumes;
  }

  /**
   * 生成环境文件内容
   */
  private generateEnvFile(env: Record<string, string>): string {
    return Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }

  /**
   * 确保命名空间存在
   */
  private async ensureNamespace(namespace: string): Promise<void> {
    try {
      await this.executeKubectl(['get', 'namespace', namespace]);
    } catch (error) {
      // 命名空间不存在，创建它
      this.logger.info(`Creating namespace: ${namespace}`);
      await this.executeKubectl(['create', 'namespace', namespace]);
    }
  }

  /**
   * 应用资源到集群
   */
  private async applyResources(resources: KubernetesResource[]): Promise<void> {
    for (const resource of resources) {
      const yaml = this.resourceToYaml(resource);
      await this.executeKubectlWithInput(['apply', '-f', '-'], yaml);
    }
  }

  /**
   * 等待部署完成
   */
  private async waitForDeployment(pluginId: string, timeoutSeconds: number = 300): Promise<void> {
    await this.executeKubectl([
      'wait',
      '--for=condition=available',
      `deployment/plugin-${pluginId}`,
      '-n', this.namespace,
      `--timeout=${timeoutSeconds}s`
    ]);
  }

  /**
   * 等待滚动更新完成
   */
  private async waitForRollout(pluginId: string, timeoutSeconds: number = 300): Promise<void> {
    await this.executeKubectl([
      'rollout', 'status',
      `deployment/plugin-${pluginId}`,
      '-n', this.namespace,
      `--timeout=${timeoutSeconds}s`
    ]);
  }

  /**
   * 等待扩缩容完成
   */
  private async waitForScale(pluginId: string, replicas: number, timeoutSeconds: number = 300): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutSeconds * 1000) {
      try {
        const deployment = await this.getDeployment(pluginId);
        if (deployment.status?.readyReplicas === replicas) {
          return;
        }
      } catch (error) {
        // 忽略错误，继续等待
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Timeout waiting for scale to ${replicas} replicas`);
  }

  /**
   * 创建插件实例信息
   */
  private async createPluginInstance(
    pluginId: string,
    metadata: PluginMetadata,
    config: PluginDeploymentConfig
  ): Promise<PluginInstance> {
    const status = await this.getPluginStatus(pluginId);

    return {
      id: pluginId,
      metadata,
      status: 'running' as any,
      config: config as any,
      healthStatus: {
        status: 'healthy',
        checks: [],
        lastCheck: new Date(),
        uptime: 0
      },
      deployment: {
        namespace: this.namespace,
        serviceName: `plugin-${pluginId}`,
        podName: status.pods[0]?.name,
        nodeId: status.pods[0]?.nodeName,
        startTime: new Date(),
        restartCount: status.pods.reduce((sum, pod) => sum + pod.restartCount, 0)
      },
      metrics: {
        cpu: 0,
        memory: 0,
        requests: 0,
        errors: 0,
        latency: 0
      }
    };
  }

  /**
   * 清理失败的部署
   */
  private async cleanupFailedDeployment(pluginId: string): Promise<void> {
    try {
      await this.undeployPlugin(pluginId);
    } catch (error) {
      this.logger.warn(`Failed to cleanup deployment: ${pluginId}`, error);
    }
  }

  /**
   * 将资源转换为YAML
   */
  private resourceToYaml(resource: KubernetesResource): string {
    // 简单的YAML序列化，生产环境应使用专业的YAML库
    return JSON.stringify(resource, null, 2);
  }

  /**
   * 获取部署信息
   */
  private async getDeployment(pluginId: string): Promise<any> {
    const result = await this.executeKubectl([
      'get', 'deployment', `plugin-${pluginId}`,
      '-n', this.namespace,
      '-o', 'json'
    ]);
    return JSON.parse(result.stdout);
  }

  /**
   * 获取服务信息
   */
  private async getService(pluginId: string): Promise<any> {
    const result = await this.executeKubectl([
      'get', 'service', `plugin-${pluginId}`,
      '-n', this.namespace,
      '-o', 'json'
    ]);
    return JSON.parse(result.stdout);
  }

  /**
   * 获取Pod信息
   */
  private async getPods(pluginId: string): Promise<any[]> {
    const result = await this.executeKubectl([
      'get', 'pods',
      '-l', `app=plugin-${pluginId}`,
      '-n', this.namespace,
      '-o', 'json'
    ]);
    const response = JSON.parse(result.stdout);
    return response.items || [];
  }

  /**
   * 检查Pod是否就绪
   */
  private isPodReady(pod: any): boolean {
    const conditions = pod.status?.conditions || [];
    const readyCondition = conditions.find((c: any) => c.type === 'Ready');
    return readyCondition?.status === 'True';
  }

  /**
   * 获取Pod重启次数
   */
  private getPodRestartCount(pod: any): number {
    const containerStatuses = pod.status?.containerStatuses || [];
    return containerStatuses.reduce((sum: number, status: any) => sum + (status.restartCount || 0), 0);
  }

  /**
   * 删除各种资源的方法
   */
  private async deleteService(pluginId: string): Promise<void> {
    try {
      await this.executeKubectl(['delete', 'service', `plugin-${pluginId}`, '-n', this.namespace]);
    } catch (error) {
      this.logger.warn(`Failed to delete service: ${pluginId}`, error);
    }
  }

  private async deleteDeployment(pluginId: string): Promise<void> {
    try {
      await this.executeKubectl(['delete', 'deployment', `plugin-${pluginId}`, '-n', this.namespace]);
    } catch (error) {
      this.logger.warn(`Failed to delete deployment: ${pluginId}`, error);
    }
  }

  private async deleteConfigMap(pluginId: string): Promise<void> {
    try {
      await this.executeKubectl(['delete', 'configmap', `plugin-${pluginId}-config`, '-n', this.namespace]);
    } catch (error) {
      this.logger.warn(`Failed to delete configmap: ${pluginId}`, error);
    }
  }

  private async deleteSecret(pluginId: string): Promise<void> {
    try {
      await this.executeKubectl(['delete', 'secret', `plugin-${pluginId}-secret`, '-n', this.namespace]);
    } catch (error) {
      this.logger.warn(`Failed to delete secret: ${pluginId}`, error);
    }
  }

  private async deletePVC(pluginId: string): Promise<void> {
    try {
      await this.executeKubectl(['delete', 'pvc', `plugin-${pluginId}-storage`, '-n', this.namespace]);
    } catch (error) {
      this.logger.warn(`Failed to delete PVC: ${pluginId}`, error);
    }
  }
}
