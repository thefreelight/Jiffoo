/**
 * The labels of the records a merchant exports and the statuses of those records.
 *
 * The CSV exports of the API read these labels, and the merchant surface shows the same
 * statuses. They live in a module of their own because the message catalogue is assembled per
 * locale: a consumer that reads one status through the catalogue reaches every label of every
 * namespace, so a change to one label of the merchant namespace would select every suite of
 * every application. The merchant namespace composes these labels, so every string has exactly
 * one definition.
 */

type Locale = 'en' | 'zh-Hans' | 'zh-Hant';

export const adminRecordLabels = {
  'en': {
    order: {
      pending: 'Pending',
      paid: 'Paid',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
      unpaid: 'Unpaid',
      yes: 'Yes',
      no: 'No',
    },
    product: {
      active: 'Active',
      inactive: 'Inactive',
      outOfStock: 'Out of stock',
      yes: 'Yes',
      no: 'No',
    },
    customer: {
      active: 'Active',
      inactive: 'Inactive',
      yes: 'Yes',
      no: 'No',
    },
    csv: {
      catalog: "SPU|Product name|Product status|Category|Variant name|SKU|Sale price|Stock|Variant active|Product updated at|Time zone|Product ID|Variant ID",
      orders: "Order number|Placed at|Time zone|Status|Payment status|Payment review pending|Customer email|Customer name|Item count|Item quantity|Subtotal|Shipping|Tax|Tax inclusive|Total|Currency|Payment method|Recipient name|Phone|Address line 1|Address line 2|City|State / province|Postal code|Country|Carrier|Tracking number|Shipped at",
      customers: "Name|Email|Status|Email verified|Orders|Paid total|Currency|Last order|Registered",
    },
  },
  'zh-Hans': {
    order: {
      pending: '待付款',
      paid: '已付款',
      processing: '处理中',
      shipped: '已发货',
      delivered: '已送达',
      cancelled: '已取消',
      refunded: '已退款',
      unpaid: '未付款',
      yes: '是',
      no: '否',
    },
    product: {
      active: '在售',
      inactive: '已下架',
      outOfStock: '缺货',
      yes: '是',
      no: '否',
    },
    customer: {
      active: '正常',
      inactive: '已停用',
      yes: '是',
      no: '否',
    },
    csv: {
      catalog: "SPU|商品名称|商品状态|分类|规格名称|SKU|售价|库存|规格在售|商品更新时间|时区|商品编号|规格编号",
      orders: "订单编号|下单时间|时区|状态|付款状态|付款待审核|客户邮箱|客户姓名|商品种数|商品数量|小计|运费|税额|含税|总计|币种|付款方式|收件人|电话|地址第一行|地址第二行|城市|州／省|邮政编码|国家|承运商|物流单号|发货时间",
      customers: "名字|邮箱|状态|邮箱已验证|订单数|累计消费|货币|最近下单|注册时间",
    },
  },
  'zh-Hant': {
    order: {
      pending: '待付款',
      paid: '已付款',
      processing: '處理中',
      shipped: '已發貨',
      delivered: '已送達',
      cancelled: '已取消',
      refunded: '已退款',
      unpaid: '未付款',
      yes: '是',
      no: '否',
    },
    product: {
      active: '販售中',
      inactive: '已下架',
      outOfStock: '缺貨',
      yes: '是',
      no: '否',
    },
    customer: {
      active: '正常',
      inactive: '已停用',
      yes: '是',
      no: '否',
    },
    csv: {
      catalog: "SPU|商品名稱|商品狀態|分類|規格名稱|SKU|售價|庫存|規格在售|商品更新時間|時區|商品編號|規格編號",
      orders: "訂單編號|下單時間|時區|狀態|付款狀態|付款待審核|客戶信箱|客戶姓名|商品種類數|商品數量|小計|運費|稅額|含稅|總計|幣別|付款方式|收件人|電話|地址第一行|地址第二行|城市|州／省|郵遞區號|國家|承運商|物流單號|出貨時間",
      customers: "名字|郵箱|狀態|郵箱已驗證|訂單數|累計消費|貨幣|最近下單|註冊時間",
    },
  },
};

/** The labels of one locale. */
export function recordLabels(locale: Locale) {
  return adminRecordLabels[locale];
}
