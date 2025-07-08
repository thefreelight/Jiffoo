#!/usr/bin/env python3
import subprocess
import time
import os
import sys

def run_command(cmd, description):
    """运行命令并处理输出"""
    print(f"🔄 {description}...")
    try:
        # 设置环境变量，避免vim干扰
        env = os.environ.copy()
        env['EDITOR'] = 'nano'  # 或者其他编辑器
        env['VISUAL'] = 'nano'
        
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True,
            env=env,
            cwd='/Users/jordan/Projects/jiffoo-mall-core'
        )
        
        if result.returncode == 0:
            print(f"✅ {description} 成功")
            if result.stdout:
                print(result.stdout)
        else:
            print(f"❌ {description} 失败")
            print(f"错误: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"❌ {description} 异常: {e}")
        return False

def main():
    print("🚀 启动 Jiffoo Mall Docker 开发环境")
    print("=" * 50)
    
    # 检查Docker是否可用
    if not run_command("docker --version", "检查Docker版本"):
        print("请确保Docker已安装并运行")
        sys.exit(1)
    
    # 检查docker-compose是否可用
    if not run_command("docker-compose --version", "检查Docker Compose版本"):
        print("请确保Docker Compose已安装")
        sys.exit(1)
    
    # 停止可能存在的容器
    run_command("docker-compose -f docker-compose.dev.yml down", "停止现有容器")
    
    # 启动数据库和Redis
    if not run_command("docker-compose -f docker-compose.dev.yml up -d postgres redis", "启动数据库和Redis"):
        sys.exit(1)
    
    print("⏳ 等待数据库启动 (15秒)...")
    time.sleep(15)
    
    # 启动后端
    if not run_command("docker-compose -f docker-compose.dev.yml up -d backend", "启动后端服务"):
        sys.exit(1)
    
    print("⏳ 等待后端启动 (20秒)...")
    time.sleep(20)
    
    # 启动前端和管理后台
    if not run_command("docker-compose -f docker-compose.dev.yml up -d frontend admin", "启动前端和管理后台"):
        sys.exit(1)
    
    print("\n🎉 启动完成！")
    print("=" * 50)
    print("🌐 服务访问地址：")
    print("  🛍️  前端商城:      http://localhost:3000")
    print("  ⚙️  管理后台:      http://localhost:3001")
    print("  📊 后端API:       http://localhost:8001")
    print("  📚 API文档:       http://localhost:8001/docs")
    print("  🗄️  PostgreSQL:    localhost:5433")
    print("  🔴 Redis:         localhost:6380")
    print("\n💡 查看状态: docker-compose -f docker-compose.dev.yml ps")
    print("💡 查看日志: docker-compose -f docker-compose.dev.yml logs -f")
    print("💡 停止服务: docker-compose -f docker-compose.dev.yml down")
    
    # 显示服务状态
    print("\n📊 当前服务状态:")
    run_command("docker-compose -f docker-compose.dev.yml ps", "查看服务状态")

if __name__ == "__main__":
    main()
