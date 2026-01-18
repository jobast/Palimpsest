import { useStatsStore } from '@/stores/statsStore'
import { Toast } from './Toast'

/**
 * ToastContainer Component
 *
 * Manages and displays toast notifications from the stats store.
 * Should be placed at the root level of the app.
 */
export function ToastContainer() {
  const { pendingNotifications, clearNotification } = useStatsStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
      {pendingNotifications.map((notification, index) => (
        <Toast
          key={`${notification.type}-${index}`}
          type={notification.type}
          message={notification.message}
          onClose={() => clearNotification(index)}
          index={index}
        />
      ))}
    </div>
  )
}
