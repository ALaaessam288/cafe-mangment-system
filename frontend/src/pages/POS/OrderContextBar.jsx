import { ShoppingBag, Bike, Users, RefreshCw } from 'lucide-react';
import { statusWithAge } from './tableStatus';

/**
 * What the cashier is working on, in one line, above the menu.
 *
 * <p>This is the other half of collapsing the table panel. Hiding the picker after a choice only
 * works if the choice stays visible somewhere - otherwise a cashier who looks away for ten
 * seconds has no way to confirm which table they are about to charge, which is a worse mistake
 * than a cramped screen. One badge, the status in words, and a way back to the picker.
 */
export default function OrderContextBar({ table, order, onChangeTable }) {
  const isTakeaway = !table && order;
  const isDelivery = isTakeaway && Boolean(order.customerAddress || parseFloat(order.deliveryFee) > 0);

  if (!table && !order) {
    return (
      <div className="order-context order-context--empty">
        <Users size={15} />
        <span>اختار الترابيزة ونبدأ</span>
      </div>
    );
  }

  const icon = isDelivery ? <Bike size={15} /> : isTakeaway ? <ShoppingBag size={15} /> : <Users size={15} />;
  const title = isDelivery ? 'دليفري'
    : isTakeaway ? `تيك أواي #${order.orderNumber}`
    : `ترابيزة ${table.number}`;

  return (
    <div className="order-context">
      <span className="order-context__badge">
        {icon}
        <strong>{title}</strong>
        <span className="order-context__dot" aria-hidden="true">•</span>
        {/* In words, never colour alone. */}
        <span className="order-context__status">{statusWithAge(order)}</span>
      </span>

      {isTakeaway && order.customerName && (
        <span className="order-context__customer">{order.customerName}</span>
      )}

      {onChangeTable && (
        <button
          type="button"
          className="order-context__change"
          onClick={onChangeTable}
          title={isTakeaway ? 'رجوع لقائمة الأوردرات' : 'تغيير الترابيزة'}
        >
          <RefreshCw size={13} />
          <span>{isTakeaway ? 'تغيير الأوردر' : 'تغيير الترابيزة'}</span>
        </button>
      )}
    </div>
  );
}
