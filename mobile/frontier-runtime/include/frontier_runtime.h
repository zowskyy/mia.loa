#ifndef FRONTIER_RUNTIME_H
#define FRONTIER_RUNTIME_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Start the compiled Frontier application.
int32_t frontier_app_main(void);

/// Dispatch UI events from Kotlin / Swift shells.
void frontier_on_event(const char *event_type, const char *event_data);

/// Runtime version string (static, do not free).
const char *frontier_runtime_version(void);

#ifdef __cplusplus
}
#endif

#endif
