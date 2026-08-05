import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        let controller = UIViewController()
        controller.view.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.1, alpha: 1)
        let label = UILabel(frame: controller.view.bounds)
        label.text = "⚡ Lighthouse Native\nFrontier runtime"
        label.textColor = .white
        label.numberOfLines = 0
        label.textAlignment = .center
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        controller.view.addSubview(label)
        window?.rootViewController = controller
        window?.makeKeyAndVisible()

        // Link libfrontier_app.a and call frontier_app_main() from Xcode build settings
        return true
    }
}
