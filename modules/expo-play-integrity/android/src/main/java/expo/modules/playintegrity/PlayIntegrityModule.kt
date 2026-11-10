package expo.modules.playintegrity

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayIntegrityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayIntegrity")

    AsyncFunction("requestIntegrityToken") {
        cloudProjectNumber: Double,
        nonce: String,
        promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val request = IntegrityTokenRequest.builder()
        .setCloudProjectNumber(cloudProjectNumber.toLong())
        .setNonce(nonce)
        .build()

      IntegrityManagerFactory.create(context)
        .requestIntegrityToken(request)
        .addOnSuccessListener { result -> promise.resolve(result.token()) }
        .addOnFailureListener { error ->
          promise.reject(
            "PLAY_INTEGRITY_FAILED",
            "Could not verify this Android app installation.",
            error,
          )
        }
    }
  }
}
