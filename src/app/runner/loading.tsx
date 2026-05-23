export default function RunnerLoading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/30 mb-4">
          <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-green-400 font-medium">Connecting to delivery network...</p>
      </div>
    </div>
  )
}
