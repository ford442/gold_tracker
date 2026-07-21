import { useMemo, useState } from 'react';
import { useOrderStore } from '@/store/orderStore';
import { useAuthStore } from '@/store/useAuthStore';
import { canCancelOrder, type OrderLifecycleState, type OrderRecord } from '@lib/orderLifecycle';
import { cancelOrderWithLifecycle } from '@lib/executeOrder';
import { formatTimeAgo } from '@lib/utils';

const STATE_CHIP: Record<OrderLifecycleState, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge-gold' },
  submitted: { label: 'Submitted', className: 'badge-accent' },
  open: { label: 'Open', className: 'badge-accent' },
  partially_filled: { label: 'Partial', className: 'badge-gold' },
  filled: { label: 'Filled', className: 'badge-green' },
  cancelled: { label: 'Cancelled', className: 'badge-red' },
  failed: { label: 'Failed', className: 'badge-red' },
  needs_attention: { label: 'Needs attention', className: 'badge-red' },
};

function StatusChip({ state }: { state: OrderLifecycleState }) {
  const chip = STATE_CHIP[state];
  return (
    <span className={chip.className} style={{ fontSize: 'var(--font-xxs)', padding: '2px 8px' }}>
      {chip.label}
    </span>
  );
}

function OrderRow({
  order,
  onCancel,
  cancelling,
}: {
  order: OrderRecord;
  onCancel: (order: OrderRecord) => void;
  cancelling: string | null;
}) {
  const modeLabel = order.mode === 'paper' ? '🧪 PAPER' : '🚀 LIVE';

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)' }}>
        {order.clientOrderId.slice(0, 14)}…
      </td>
      <td>{order.exchange.toUpperCase()}</td>
      <td>
        {order.side} {order.productId}
      </td>
      <td>
        {order.filledQty}/{order.requestedQty}
      </td>
      <td>
        <StatusChip state={order.state} />
        {order.needsAttention && order.attentionReason && (
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-red)', marginTop: '4px' }}>
            {order.attentionReason}
          </div>
        )}
      </td>
      <td style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
        {modeLabel}
      </td>
      <td style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
        {formatTimeAgo(order.updatedAt)}
      </td>
      <td>
        {canCancelOrder(order) && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={cancelling === order.clientOrderId}
            style={{
              fontSize: 'var(--font-xxs)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: cancelling === order.clientOrderId ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling === order.clientOrderId ? '…' : 'Cancel'}
          </button>
        )}
      </td>
    </tr>
  );
}

export function OrderHistoryPanel() {
  const orders = useOrderStore((s) => s.orders);
  const { user } = useAuthStore();
  const [cancelling, setCancelling] = useState<string | null>(null);

  const openOrders = useMemo(
    () =>
      orders.filter((o) =>
        ['open', 'partially_filled', 'submitted', 'pending', 'needs_attention'].includes(o.state),
      ),
    [orders],
  );

  const history = useMemo(
    () => orders.filter((o) => !openOrders.some((x) => x.clientOrderId === o.clientOrderId)),
    [orders, openOrders],
  );

  const handleCancel = async (order: OrderRecord) => {
    setCancelling(order.clientOrderId);
    try {
      await cancelOrderWithLifecycle(order, user);
    } finally {
      setCancelling(null);
    }
  };

  if (orders.length === 0) {
    return (
      <section className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
        <h3 className="section-heading" style={{ margin: '0 0 8px' }}>
          📋 Order Journal
        </h3>
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--font-sm)' }}>
          No orders yet. Live and paper executions will appear here with lifecycle status.
        </p>
      </section>
    );
  }

  const table = (rows: OrderRecord[], title: string) => (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 'var(--font-sm)', color: 'var(--color-muted)' }}>
        {title} ({rows.length})
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="table-zebra" style={{ width: '100%', fontSize: 'var(--font-sm)' }}>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Venue</th>
              <th>Order</th>
              <th>Fill</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <OrderRow
                key={order.clientOrderId}
                order={order}
                onCancel={handleCancel}
                cancelling={cancelling}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
      <h3 className="section-heading" style={{ margin: '0 0 4px' }}>
        📋 Order Journal
      </h3>
      <p style={{ margin: '0 0 16px', color: 'var(--color-muted)', fontSize: 'var(--font-xs)' }}>
        Durable order lifecycle — reconciles after reload when status is non-terminal.
      </p>
      {openOrders.length > 0 && table(openOrders, 'Open orders')}
      {history.length > 0 && table(history.slice(0, 50), 'History')}
    </section>
  );
}

export default OrderHistoryPanel;
