import { Pool, PoolClient, PoolConfig } from 'pg';
import { Logger } from '../utils/Logger';
import { PluginError } from '../types/PluginTypes';

/**
 * 数据库管理器
 * 负责数据库连接、事务管理和查询执行
 */
export class DatabaseManager {
  private pool: Pool;
  private logger: Logger;
  private config: PoolConfig;
  private connected: boolean = false;

  constructor(config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    pool?: {
      min?: number;
      max?: number;
      idle?: number;
    };
  }) {
    this.logger = new Logger('DatabaseManager');
    
    this.config = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      min: config.pool?.min || 2,
      max: config.pool?.max || 10,
      idleTimeoutMillis: config.pool?.idle || 10000,
      connectionTimeoutMillis: 30000,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'jiffoo-plugin'
    };

    this.pool = new Pool(this.config);
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.logger.debug('New database client connected');
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Database client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Database client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      this.logger.error('Database pool error', err);
    });
  }

  /**
   * 连接数据库
   */
  public async connect(): Promise<void> {
    try {
      // 测试连接
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.connected = true;
      this.logger.info('Database connected successfully');
    } catch (error) {
      this.connected = false;
      this.logger.error('Failed to connect to database', error);
      throw new PluginError('Database connection failed', 'DB_CONNECTION_ERROR', 500, error);
    }
  }

  /**
   * 断开数据库连接
   */
  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.connected = false;
      this.logger.info('Database disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
      throw new PluginError('Database disconnection failed', 'DB_DISCONNECTION_ERROR', 500, error);
    }
  }

  /**
   * 检查连接状态
   */
  public async isConnectedToDatabase(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      this.logger.error('Database connection check failed', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * 执行查询
   */
  public async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    let client: PoolClient | undefined;

    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      
      const duration = Date.now() - start;
      this.logger.debug(`Query executed in ${duration}ms`, { query: text, params });
      
      return result.rows;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(`Query failed after ${duration}ms`, { query: text, params, error });
      throw new PluginError('Database query failed', 'DB_QUERY_ERROR', 500, error);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 执行单个查询并返回第一行
   */
  public async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 执行事务
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      this.logger.debug('Transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      this.logger.debug('Transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back', error);
      throw new PluginError('Transaction failed', 'DB_TRANSACTION_ERROR', 500, error);
    } finally {
      client.release();
    }
  }

  /**
   * 批量插入
   */
  public async batchInsert<T>(
    table: string,
    columns: string[],
    data: T[][],
    onConflict?: string
  ): Promise<void> {
    if (data.length === 0) {
      return;
    }

    const placeholders = data.map((_, index) => {
      const start = index * columns.length + 1;
      const end = start + columns.length - 1;
      const params = Array.from({ length: columns.length }, (_, i) => `$${start + i}`);
      return `(${params.join(', ')})`;
    }).join(', ');

    const values = data.flat();
    const conflictClause = onConflict ? `ON CONFLICT ${onConflict}` : '';
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders}
      ${conflictClause}
    `;

    await this.query(query, values);
    this.logger.debug(`Batch inserted ${data.length} rows into ${table}`);
  }

  /**
   * 分页查询
   */
  public async paginate<T>(
    baseQuery: string,
    params: any[],
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
    const countResult = await this.queryOne<{ total: string }>(countQuery, params);
    const total = parseInt(countResult?.total || '0');

    // 获取分页数据
    const offset = (page - 1) * limit;
    const dataQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const data = await this.query<T>(dataQuery, [...params, limit, offset]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * 执行原始SQL文件
   */
  public async executeSqlFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // 分割SQL语句（简单实现）
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      await this.transaction(async (client) => {
        for (const statement of statements) {
          await client.query(statement);
        }
      });

      this.logger.info(`Executed SQL file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to execute SQL file: ${filePath}`, error);
      throw new PluginError('SQL file execution failed', 'DB_SQL_FILE_ERROR', 500, error);
    }
  }

  /**
   * 获取表结构信息
   */
  public async getTableInfo(tableName: string): Promise<{
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      default: string | null;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
  }> {
    // 获取列信息
    const columnsQuery = `
      SELECT 
        column_name as name,
        data_type as type,
        is_nullable = 'YES' as nullable,
        column_default as default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    const columns = await this.query(columnsQuery, [tableName]);

    // 获取索引信息
    const indexesQuery = `
      SELECT 
        i.relname as name,
        array_agg(a.attname ORDER BY c.ordinality) as columns,
        ix.indisunique as unique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN unnest(ix.indkey) WITH ORDINALITY c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE t.relname = $1
      GROUP BY i.relname, ix.indisunique
    `;
    const indexes = await this.query(indexesQuery, [tableName]);

    return { columns, indexes };
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      poolSize: number;
      idleConnections: number;
      waitingClients: number;
    };
  }> {
    try {
      const connected = await this.isConnectedToDatabase();
      
      return {
        status: connected ? 'healthy' : 'unhealthy',
        details: {
          connected,
          poolSize: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingClients: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          poolSize: 0,
          idleConnections: 0,
          waitingClients: 0
        }
      };
    }
  }

  /**
   * 获取连接池统计信息
   */
  public getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * 检查是否连接
   */
  public isConnected(): boolean {
    return this.connected;
  }
}
