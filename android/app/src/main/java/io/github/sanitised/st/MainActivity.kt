package io.github.sanitised.st

import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

class MainActivity : ComponentActivity(), NodeStatusListener {
    companion object {
        private const val PORT = 51821
        private const val LOCAL_ORIGIN = "http://127.0.0.1:$PORT"
        private const val HEALTH_PATH = "/login"
    }

    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var loadingPanel: LinearLayout
    private lateinit var stageText: TextView
    private lateinit var detailText: TextView
    private lateinit var retryButton: Button
    private var nodeService: NodeService? = null
    private var isBound = false
    private var pendingRestart = false
    private var webLoadStarted = false
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val healthGeneration = AtomicInteger(0)
    private val healthExecutor = Executors.newSingleThreadExecutor()

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileCallback ?: return@registerForActivityResult
        fileCallback = null
        callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val localBinder = binder as? NodeService.LocalBinder
            nodeService = localBinder?.getService()
            nodeService?.registerListener(this@MainActivity)
            startNodeService()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            nodeService = null
            showFailure("本地服务连接已断开")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        configureWebView()
        requestNotificationPermissionIfNeeded()
        bindNodeService()
        startNodeService()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    webView.visibility == View.VISIBLE && webView.canGoBack() -> webView.goBack()
                    else -> moveTaskToBack(true)
                }
            }
        })
    }

    private fun bindNodeService() {
        if (isBound) return
        isBound = bindService(Intent(this, NodeService::class.java), serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun startNodeService() {
        showLoading("正在准备应用文件", "首次启动需要释放完整酒馆资源")
        val intent = Intent(this, NodeService::class.java).apply {
            action = NodeService.ACTION_START
            putExtra(NodeService.EXTRA_PORT, PORT)
        }
        ContextCompat.startForegroundService(this, intent)
    }

    override fun onStatus(status: NodeStatus) {
        runOnUiThread {
            when (status.state) {
                NodeState.STARTING -> showLoading("正在启动本地服务", status.message)
                NodeState.RUNNING -> {
                    showLoading("正在检查本地服务", "等待 SillyTavern HTTP 接口就绪")
                    beginHealthCheck()
                }
                NodeState.STOPPING -> showLoading("正在停止本地服务", status.message)
                NodeState.STOPPED -> {
                    healthGeneration.incrementAndGet()
                    if (pendingRestart) {
                        pendingRestart = false
                        webLoadStarted = false
                        startNodeService()
                    }
                }
                NodeState.ERROR -> showFailure(status.message.ifBlank { "本地服务启动失败" })
            }
        }
    }

    private fun beginHealthCheck() {
        val generation = healthGeneration.incrementAndGet()
        healthExecutor.execute {
            val deadline = System.nanoTime() + 120_000_000_000L
            var lastReason = "尚未监听"
            while (healthGeneration.get() == generation && System.nanoTime() < deadline) {
                try {
                    val connection = URL("$LOCAL_ORIGIN$HEALTH_PATH").openConnection() as HttpURLConnection
                    connection.connectTimeout = 1_000
                    connection.readTimeout = 1_000
                    connection.useCaches = false
                    connection.instanceFollowRedirects = false
                    connection.requestMethod = "GET"
                    val responseCode = connection.responseCode
                    val ready = responseCode in 200..399
                    connection.disconnect()
                    if (ready) {
                        runOnUiThread { openLocalUi(generation) }
                        return@execute
                    }
                    lastReason = "HTTP $responseCode"
                } catch (error: Exception) {
                    lastReason = error.message ?: error.javaClass.simpleName
                }
                Thread.sleep(100)
            }
            if (healthGeneration.get() == generation) {
                runOnUiThread { showFailure("本地服务健康检查超时：$lastReason") }
            }
        }
    }

    private fun openLocalUi(generation: Int) {
        if (healthGeneration.get() != generation || webLoadStarted) return
        webLoadStarted = true
        showLoading("正在加载界面", "等待核心页面初始化")
        webView.visibility = View.VISIBLE
        webView.loadUrl(LOCAL_ORIGIN)
    }

    private fun retry() {
        retryButton.isEnabled = false
        healthGeneration.incrementAndGet()
        webView.stopLoading()
        webView.loadUrl("about:blank")
        webView.visibility = View.GONE
        webLoadStarted = false
        pendingRestart = true
        val service = nodeService
        if (service == null) {
            pendingRestart = false
            bindNodeService()
            startNodeService()
        } else {
            service.stopNode()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
        }
        webView.addJavascriptInterface(ReadyBridge(), "NewSillyTavernAndroid")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val intent = runCatching { fileChooserParams?.createIntent() }.getOrNull()
                    ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                filePicker.launch(intent)
                return true
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "http" && uri.host == "127.0.0.1" && uri.port == PORT) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!isLocalUrl(url)) return
                view.evaluateJavascript(
                    """
                    (() => {
                      import('$LOCAL_ORIGIN/scripts/events.js')
                        .then(({ eventSource, event_types }) => {
                          eventSource.once(
                            event_types.APP_READY,
                            () => window.NewSillyTavernAndroid.uiReady()
                          );
                        })
                        .catch(error => console.error('Android uiReady hook failed', error));
                    })();
                    """.trimIndent(),
                    null
                )
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showFailure("界面加载失败：${error.description}")
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: android.net.http.SslError?) {
                handler?.cancel()
                showFailure("TLS 证书校验失败")
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                showFailure("WebView 已停止，点击重试恢复")
                return true
            }
        }
    }

    private inner class ReadyBridge {
        @JavascriptInterface
        fun uiReady() {
            runOnUiThread {
                if (!isLocalUrl(webView.url)) return@runOnUiThread
                loadingPanel.visibility = View.GONE
                webView.visibility = View.VISIBLE
                Log.i("NewSillyTavern", "uiReady accepted for ${webView.url}")
            }
        }
    }

    private fun isLocalUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        return uri.scheme == "http" && uri.host == "127.0.0.1" && uri.port == PORT
    }

    private fun buildUi() {
        root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(10, 14, 20)) }
        webView = WebView(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.rgb(10, 14, 20))
        }
        root.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))

        val title = TextView(this).apply {
            text = "新酒馆"
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        stageText = TextView(this).apply {
            textSize = 17f
            setTextColor(Color.rgb(224, 235, 245))
            gravity = Gravity.CENTER
        }
        detailText = TextView(this).apply {
            textSize = 13f
            setTextColor(Color.rgb(155, 174, 190))
            gravity = Gravity.CENTER
        }
        val progress = ProgressBar(this).apply { isIndeterminate = true }
        retryButton = Button(this).apply {
            text = "重试"
            visibility = View.GONE
            setOnClickListener { retry() }
        }
        loadingPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(28), dp(24), dp(28))
            background = GradientDrawable().apply {
                setColor(Color.argb(232, 20, 27, 37))
                cornerRadius = dp(8).toFloat()
                setStroke(dp(1), Color.rgb(66, 205, 190))
            }
            addView(title, panelChildParams(top = 0))
            addView(progress, panelChildParams(top = 22))
            addView(stageText, panelChildParams(top = 18))
            addView(detailText, panelChildParams(top = 8))
            addView(retryButton, panelChildParams(top = 18))
        }
        root.addView(loadingPanel, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        ).apply { marginStart = dp(24); marginEnd = dp(24) })
        setContentView(root)
    }

    private fun panelChildParams(top: Int) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(top) }

    private fun showLoading(stage: String, detail: String) {
        loadingPanel.visibility = View.VISIBLE
        stageText.text = stage
        detailText.text = detail
        retryButton.visibility = View.GONE
        retryButton.isEnabled = true
    }

    private fun showFailure(reason: String) {
        loadingPanel.visibility = View.VISIBLE
        stageText.text = "启动失败"
        detailText.text = reason
        retryButton.visibility = View.VISIBLE
        retryButton.isEnabled = true
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        healthGeneration.incrementAndGet()
        nodeService?.unregisterListener(this)
        if (isBound) unbindService(serviceConnection)
        isBound = false
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        webView.removeJavascriptInterface("NewSillyTavernAndroid")
        webView.destroy()
        healthExecutor.shutdownNow()
        super.onDestroy()
    }
}
