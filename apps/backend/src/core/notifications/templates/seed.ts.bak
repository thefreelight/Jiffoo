import { prisma } from '@/config/database';
import { TemplateType } from '../types';

export async function seedNotificationTemplates() {
  const templates = [
    {
      type: TemplateType.ORDER_CONFIRMATION,
      name: '订单确认通知',
      description: '用户下单后的确认邮件',
      subject: '订单确认 - 订单号 {{orderNumber}}',
      content: `
        <h2>订单确认</h2>
        <p>亲爱的 {{customerName}}，</p>
        <p>感谢您在 Jiffoo Mall 购物！您的订单已确认。</p>
        <div class="order-details">
          <p><strong>订单号：</strong>{{orderNumber}}</p>
          <p><strong>订单金额：</strong>¥{{totalAmount}}</p>
          <p><strong>下单时间：</strong>{{orderDate}}</p>
        </div>
        <p>我们将尽快为您处理订单，请耐心等待。</p>
      `,
      variables: JSON.stringify(['customerName', 'orderNumber', 'totalAmount', 'orderDate']),
      isActive: true
    },
    {
      type: TemplateType.ORDER_SHIPPED,
      name: '订单发货通知',
      description: '订单发货后的通知邮件',
      subject: '您的订单已发货 - 订单号 {{orderNumber}}',
      content: `
        <h2>订单发货通知</h2>
        <p>亲爱的 {{customerName}}，</p>
        <p>您的订单已发货！</p>
        <div class="shipping-details">
          <p><strong>订单号：</strong>{{orderNumber}}</p>
          <p><strong>快递单号：</strong>{{trackingNumber}}</p>
          <p><strong>发货时间：</strong>{{shippedDate}}</p>
        </div>
        <p>您可以通过快递单号查询物流信息。</p>
      `,
      variables: JSON.stringify(['customerName', 'orderNumber', 'trackingNumber', 'shippedDate']),
      isActive: true
    },
    {
      type: TemplateType.LOW_STOCK_ALERT,
      name: '低库存警告',
      description: '商品库存不足时的警告通知',
      subject: '库存警告 - {{productName}}',
      content: `
        <h2>⚠️ 库存不足警告</h2>
        <p>以下商品库存不足，请及时补货：</p>
        <div class="product-alert">
          <p><strong>商品名称：</strong>{{productName}}</p>
          <p><strong>商品ID：</strong>{{productId}}</p>
          <p><strong>当前库存：</strong>{{currentStock}}</p>
          <p><strong>警告阈值：</strong>{{threshold}}</p>
        </div>
        <p>建议尽快补货以避免缺货影响销售。</p>
      `,
      variables: JSON.stringify(['productName', 'productId', 'currentStock', 'threshold']),
      isActive: true
    },
    {
      type: TemplateType.OUT_OF_STOCK_ALERT,
      name: '缺货警告',
      description: '商品缺货时的紧急通知',
      subject: '🚨 紧急缺货警告 - {{productName}}',
      content: `
        <h2>🚨 商品缺货警告</h2>
        <p>以下商品已缺货，请立即处理：</p>
        <div class="urgent-alert">
          <p><strong>商品名称：</strong>{{productName}}</p>
          <p><strong>商品ID：</strong>{{productId}}</p>
          <p><strong>当前库存：</strong>{{currentStock}}</p>
        </div>
        <p style="color: red;"><strong>请立即补货！</strong></p>
      `,
      variables: JSON.stringify(['productName', 'productId', 'currentStock']),
      isActive: true
    },
    {
      type: TemplateType.USER_WELCOME,
      name: '用户欢迎邮件',
      description: '新用户注册后的欢迎邮件',
      subject: '欢迎加入 Jiffoo Mall！',
      content: `
        <h2>🎉 欢迎加入 Jiffoo Mall！</h2>
        <p>亲爱的 {{username}}，</p>
        <p>欢迎您注册成为 Jiffoo Mall 的会员！</p>
        <div class="welcome-benefits">
          <h3>在这里您可以：</h3>
          <ul>
            <li>浏览丰富的商品目录</li>
            <li>享受优质的购物体验</li>
            <li>获得专属优惠和促销</li>
            <li>享受便捷的售后服务</li>
          </ul>
        </div>
        <p>开始您的购物之旅吧！</p>
      `,
      variables: JSON.stringify(['username', 'email']),
      isActive: true
    },
    {
      type: TemplateType.PASSWORD_RESET,
      name: '密码重置邮件',
      description: '用户请求重置密码时的邮件',
      subject: '密码重置请求 - Jiffoo Mall',
      content: `
        <h2>🔐 密码重置</h2>
        <p>您好，</p>
        <p>我们收到了您的密码重置请求。</p>
        <div class="reset-info">
          <p>请点击下面的链接重置您的密码：</p>
          <p><a href="{{resetLink}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">重置密码</a></p>
          <p><small>此链接将在24小时后失效。</small></p>
        </div>
        <p>如果您没有请求重置密码，请忽略此邮件。</p>
      `,
      variables: JSON.stringify(['resetLink', 'email']),
      isActive: true
    },
    {
      type: TemplateType.PAYMENT_SUCCESS,
      name: '支付成功通知',
      description: '支付成功后的确认邮件',
      subject: '支付成功 - 订单号 {{orderNumber}}',
      content: `
        <h2>💳 支付成功</h2>
        <p>亲爱的 {{customerName}}，</p>
        <p>您的支付已成功完成！</p>
        <div class="payment-details">
          <p><strong>订单号：</strong>{{orderNumber}}</p>
          <p><strong>支付金额：</strong>¥{{amount}}</p>
          <p><strong>支付方式：</strong>{{paymentMethod}}</p>
          <p><strong>支付时间：</strong>{{paymentDate}}</p>
        </div>
        <p>我们将尽快为您发货。</p>
      `,
      variables: JSON.stringify(['customerName', 'orderNumber', 'amount', 'paymentMethod', 'paymentDate']),
      isActive: true
    },
    {
      type: TemplateType.SYSTEM_MAINTENANCE,
      name: '系统维护通知',
      description: '系统维护时的通知邮件',
      subject: '系统维护通知 - Jiffoo Mall',
      content: `
        <h2>🔧 系统维护通知</h2>
        <p>亲爱的用户，</p>
        <p>{{title}}</p>
        <div class="maintenance-info">
          <p>{{message}}</p>
          {{#if maintenanceWindow}}
          <p><strong>维护时间：</strong>{{maintenanceWindow.start}} 至 {{maintenanceWindow.end}}</p>
          {{/if}}
          {{#if estimatedDuration}}
          <p><strong>预计时长：</strong>{{estimatedDuration}}</p>
          {{/if}}
        </div>
        <p>给您带来的不便，我们深表歉意。</p>
      `,
      variables: JSON.stringify(['title', 'message', 'maintenanceWindow', 'estimatedDuration']),
      isActive: true
    }
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { type: template.type },
      update: template,
      create: template
    });
  }

  console.log('✅ Notification templates seeded successfully');
}

// 如果直接运行此文件，则执行种子数据
if (require.main === module) {
  seedNotificationTemplates()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
