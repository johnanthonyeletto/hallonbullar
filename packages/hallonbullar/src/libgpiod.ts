/**
 * Complete libgpiod v2 FFI bindings for Bun
 *
 * This provides TypeScript bindings for the libgpiod v2 API for GPIO control on Linux.
 * Requires libgpiod v2.x (libgpiod.so.3)
 *
 * @see https://libgpiod.readthedocs.io/
 */

import { dlopen, ptr, type Pointer } from "bun:ffi";

// =============================================================================
// Helper Functions
// =============================================================================

/** Convert a JavaScript string to a null-terminated C string pointer */
export const cstr = (s: string): Pointer => ptr(Buffer.from(s + "\0"));

// =============================================================================
// Enums - Line Direction
// =============================================================================

/** Possible line direction settings */
export const GPIOD_LINE_DIRECTION = {
  /** Direction is input - for reading the value of an externally driven GPIO line */
  AS_IS: 1,
  /** Direction is input */
  INPUT: 2,
  /** Direction is output */
  OUTPUT: 3,
} as const;

// =============================================================================
// Enums - Line Edge Detection
// =============================================================================

/** Possible edge detection settings */
export const GPIOD_LINE_EDGE = {
  /** Line edge detection is disabled */
  NONE: 1,
  /** Line detects rising edge events */
  RISING: 2,
  /** Line detects falling edge events */
  FALLING: 3,
  /** Line detects both rising and falling edge events */
  BOTH: 4,
} as const;

export type GpiodLineEdge =
  (typeof GPIOD_LINE_EDGE)[keyof typeof GPIOD_LINE_EDGE];

// =============================================================================
// Enums - Line Bias
// =============================================================================

/** Possible line bias settings */
export const GPIOD_LINE_BIAS = {
  /** The internal bias state is unknown */
  UNKNOWN: 1,
  /** The internal bias is disabled */
  DISABLED: 2,
  /** The internal pull-up bias is enabled */
  PULL_UP: 3,
  /** The internal pull-down bias is enabled */
  PULL_DOWN: 4,
} as const;

export type GpiodLineBias =
  (typeof GPIOD_LINE_BIAS)[keyof typeof GPIOD_LINE_BIAS];

// =============================================================================
// Enums - Line Drive
// =============================================================================

/** Possible line drive settings */
export const GPIOD_LINE_DRIVE = {
  /** Drive setting is push-pull */
  PUSH_PULL: 1,
  /** Line output is open-drain */
  OPEN_DRAIN: 2,
  /** Line output is open-source */
  OPEN_SOURCE: 3,
} as const;

// =============================================================================
// Enums - Line Value
// =============================================================================

/** Possible line value states */
export const GPIOD_LINE_VALUE = {
  /** Line value is inactive (logical low) */
  INACTIVE: 0,
  /** Line value is active (logical high) */
  ACTIVE: 1,
} as const;

// =============================================================================
// Enums - Edge Event Type
// =============================================================================

/** Edge event types */
export const GPIOD_EDGE_EVENT_TYPE = {
  /** Rising edge event */
  RISING_EDGE: 1,
  /** Falling edge event */
  FALLING_EDGE: 2,
} as const;

// =============================================================================
// Enums - Info Event Type
// =============================================================================

/** Info event types (for line status changes) */
export const GPIOD_INFO_EVENT_TYPE = {
  /** Line has been requested */
  LINE_REQUESTED: 1,
  /** Line has been released */
  LINE_RELEASED: 2,
  /** Line configuration has changed */
  LINE_CONFIG_CHANGED: 3,
} as const;

// =============================================================================
// Enums - Event Clock
// =============================================================================

/** Possible event clock settings */
export const GPIOD_LINE_CLOCK = {
  /** Time is in monotonic clock */
  MONOTONIC: 1,
  /** Time is in realtime clock */
  REALTIME: 2,
  /** Time is in HTE (Hardware Timestamp Engine) clock */
  HTE: 3,
} as const;

// =============================================================================
// Library Loading
// =============================================================================

/**
 * Load the libgpiod library
 * @param libraryPath Path to the libgpiod shared library (defaults to system library)
 */
export function loadLibgpiod(
  libraryPath: string = "/lib/aarch64-linux-gnu/libgpiod.so.3"
) {
  return dlopen(libraryPath, {
    // =========================================================================
    // Miscellaneous Functions
    // =========================================================================

    /**
     * Check if the file pointed to by path is a GPIO chip character device.
     * @param path Path to check
     * @returns True if the file exists and is either a GPIO chip character device
     *          or a symbolic link to one
     */
    gpiod_is_gpiochip_device: {
      args: ["cstring"],
      returns: "bool",
    },

    /**
     * Get the API version of the library as a human-readable string.
     * @returns A valid pointer to a human-readable string containing the library
     *          version. The pointer is valid for the lifetime of the program.
     */
    gpiod_api_version: {
      args: [],
      returns: "cstring",
    },

    // =========================================================================
    // Chip Operations
    // =========================================================================

    /**
     * Open a GPIO chip by path.
     * @param path Path to the GPIO chip character device
     * @returns GPIO chip object or NULL if an error occurred
     */
    gpiod_chip_open: {
      args: ["cstring"],
      returns: "pointer",
    },

    /**
     * Close the chip and release all associated resources.
     * @param chip GPIO chip object to close
     */
    gpiod_chip_close: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Get information about the chip.
     * @param chip GPIO chip object
     * @returns New GPIO chip info object or NULL if an error occurred.
     *          Must be freed by caller using gpiod_chip_info_free.
     */
    gpiod_chip_get_info: {
      args: ["pointer"],
      returns: "pointer",
    },

    /**
     * Get the path used to open the chip.
     * @param chip GPIO chip object
     * @returns Path to the file passed as argument to gpiod_chip_open
     */
    gpiod_chip_get_path: {
      args: ["pointer"],
      returns: "cstring",
    },

    /**
     * Get a snapshot of information about a line.
     * @param chip GPIO chip object
     * @param offset The offset of the GPIO line
     * @returns New GPIO line info object or NULL if an error occurred.
     *          Must be freed by caller using gpiod_line_info_free.
     */
    gpiod_chip_get_line_info: {
      args: ["pointer", "u32"],
      returns: "pointer",
    },

    /**
     * Get a snapshot of the status of a line and start watching it for future changes.
     * @param chip GPIO chip object
     * @param offset The offset of the GPIO line
     * @returns New GPIO line info object or NULL if an error occurred.
     *          Must be freed by caller using gpiod_line_info_free.
     */
    gpiod_chip_watch_line_info: {
      args: ["pointer", "u32"],
      returns: "pointer",
    },

    /**
     * Stop watching a line for status changes.
     * @param chip GPIO chip object
     * @param offset The offset of the GPIO line
     * @returns 0 on success, -1 on error
     */
    gpiod_chip_unwatch_line_info: {
      args: ["pointer", "u32"],
      returns: "i32",
    },

    /**
     * Get the file descriptor associated with the chip.
     * @param chip GPIO chip object
     * @returns File descriptor number for the chip
     */
    gpiod_chip_get_fd: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Wait for line status events on any of the watched lines.
     * @param chip GPIO chip object
     * @param timeout_ns Wait time limit in nanoseconds. 0 = immediate return,
     *                   negative = block indefinitely
     * @returns 0 if wait timed out, 1 if event is pending, -1 on error
     */
    gpiod_chip_wait_info_event: {
      args: ["pointer", "i64"],
      returns: "i32",
    },

    /**
     * Read a single line status change event from the chip.
     * @param chip GPIO chip object
     * @returns Newly read watch event object or NULL on error.
     *          Must be freed using gpiod_info_event_free.
     */
    gpiod_chip_read_info_event: {
      args: ["pointer"],
      returns: "pointer",
    },

    /**
     * Map a line's name to its offset within the chip.
     * @param chip GPIO chip object
     * @param name Name of the GPIO line to find
     * @returns Offset of the line within the chip or -1 on error
     */
    gpiod_chip_get_line_offset_from_name: {
      args: ["pointer", "cstring"],
      returns: "i32",
    },

    /**
     * Request a set of lines for exclusive usage.
     * @param chip GPIO chip object
     * @param req_cfg Request configuration object (can be NULL for defaults)
     * @param line_cfg Line configuration object
     * @returns New line request object or NULL if an error occurred
     */
    gpiod_chip_request_lines: {
      args: ["pointer", "pointer", "pointer"],
      returns: "pointer",
    },

    // =========================================================================
    // Chip Info Operations
    // =========================================================================

    /**
     * Free a chip info object and release all associated resources.
     * @param info GPIO chip info object to free
     */
    gpiod_chip_info_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Get the name of the chip as represented in the kernel.
     * @param info GPIO chip info object
     * @returns Chip name string
     */
    gpiod_chip_info_get_name: {
      args: ["pointer"],
      returns: "cstring",
    },

    /**
     * Get the label of the chip as represented in the kernel.
     * @param info GPIO chip info object
     * @returns Chip label string
     */
    gpiod_chip_info_get_label: {
      args: ["pointer"],
      returns: "cstring",
    },

    /**
     * Get the number of lines exposed by the chip.
     * @param info GPIO chip info object
     * @returns Number of GPIO lines
     */
    gpiod_chip_info_get_num_lines: {
      args: ["pointer"],
      returns: "usize",
    },

    // =========================================================================
    // Line Info Operations
    // =========================================================================

    /**
     * Free a line info object and release all associated resources.
     * @param info GPIO line info object to free
     */
    gpiod_line_info_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Copy a line info object.
     * @param info GPIO line info object to copy
     * @returns New line info object that must be freed using gpiod_line_info_free,
     *          or NULL on failure
     */
    gpiod_line_info_copy: {
      args: ["pointer"],
      returns: "pointer",
    },

    /**
     * Get the offset of the line.
     * @param info GPIO line info object
     * @returns Offset of the line within the chip
     */
    gpiod_line_info_get_offset: {
      args: ["pointer"],
      returns: "u32",
    },

    /**
     * Get the name of the line.
     * @param info GPIO line info object
     * @returns Name of the GPIO line, or NULL if not set
     */
    gpiod_line_info_get_name: {
      args: ["pointer"],
      returns: "cstring",
    },

    /**
     * Check if the line is in use.
     * @param info GPIO line info object
     * @returns True if the line is in use, false otherwise
     */
    gpiod_line_info_is_used: {
      args: ["pointer"],
      returns: "bool",
    },

    /**
     * Get the consumer name of the line (if in use).
     * @param info GPIO line info object
     * @returns Consumer name string, or NULL if not in use
     */
    gpiod_line_info_get_consumer: {
      args: ["pointer"],
      returns: "cstring",
    },

    /**
     * Get the direction setting of the line.
     * @param info GPIO line info object
     * @returns Direction setting (GPIOD_LINE_DIRECTION_*)
     */
    gpiod_line_info_get_direction: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Get the edge detection setting of the line.
     * @param info GPIO line info object
     * @returns Edge detection setting (GPIOD_LINE_EDGE_*)
     */
    gpiod_line_info_get_edge_detection: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Get the bias setting of the line.
     * @param info GPIO line info object
     * @returns Bias setting (GPIOD_LINE_BIAS_*)
     */
    gpiod_line_info_get_bias: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Get the drive setting of the line.
     * @param info GPIO line info object
     * @returns Drive setting (GPIOD_LINE_DRIVE_*)
     */
    gpiod_line_info_get_drive: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Check if the line is configured as active-low.
     * @param info GPIO line info object
     * @returns True if active-low is enabled, false otherwise
     */
    gpiod_line_info_is_active_low: {
      args: ["pointer"],
      returns: "bool",
    },

    /**
     * Check if the line is configured as debounced.
     * @param info GPIO line info object
     * @returns True if debounce is enabled, false otherwise
     */
    gpiod_line_info_is_debounced: {
      args: ["pointer"],
      returns: "bool",
    },

    /**
     * Get the debounce period of the line.
     * @param info GPIO line info object
     * @returns Debounce period in microseconds
     */
    gpiod_line_info_get_debounce_period_us: {
      args: ["pointer"],
      returns: "u64",
    },

    /**
     * Get the event clock setting of the line.
     * @param info GPIO line info object
     * @returns Event clock setting (GPIOD_LINE_CLOCK_*)
     */
    gpiod_line_info_get_event_clock: {
      args: ["pointer"],
      returns: "i32",
    },

    // =========================================================================
    // Info Event Operations (for line status changes)
    // =========================================================================

    /**
     * Free the info event object and release all associated resources.
     * @param event Info event object to free
     */
    gpiod_info_event_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Get the event type of the status change event.
     * @param event Info event object
     * @returns Event type (GPIOD_INFO_EVENT_*)
     */
    gpiod_info_event_get_event_type: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Get the timestamp of the event.
     * @param event Info event object
     * @returns Timestamp in nanoseconds, read from the monotonic clock
     */
    gpiod_info_event_get_timestamp_ns: {
      args: ["pointer"],
      returns: "u64",
    },

    /**
     * Get the snapshot of line-info associated with the event.
     * @param event Info event object
     * @returns Line info object. The lifetime is tied to the event object.
     *          Users must not free it.
     */
    gpiod_info_event_get_line_info: {
      args: ["pointer"],
      returns: "pointer",
    },

    // =========================================================================
    // Line Settings Operations
    // =========================================================================

    /**
     * Create a new line settings object.
     * @returns New line settings object or NULL on error.
     *          Must be freed using gpiod_line_settings_free.
     */
    gpiod_line_settings_new: {
      args: [],
      returns: "pointer",
    },

    /**
     * Free the line settings object and release all associated resources.
     * @param settings Line settings object to free
     */
    gpiod_line_settings_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Reset the line settings object to its default values.
     * @param settings Line settings object to reset
     */
    gpiod_line_settings_reset: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Copy the line settings object.
     * @param settings Line settings object to copy
     * @returns New line settings object or NULL on failure.
     *          Must be freed using gpiod_line_settings_free.
     */
    gpiod_line_settings_copy: {
      args: ["pointer"],
      returns: "pointer",
    },

    /**
     * Set direction.
     * @param settings Line settings object
     * @param direction Direction setting (GPIOD_LINE_DIRECTION_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_settings_set_direction: {
      args: ["pointer", "i32"],
      returns: "i32",
    },

    /**
     * Get direction.
     * @param settings Line settings object
     * @returns Current direction setting
     */
    gpiod_line_settings_get_direction: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Set edge detection.
     * @param settings Line settings object
     * @param edge Edge detection setting (GPIOD_LINE_EDGE_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_settings_set_edge_detection: {
      args: ["pointer", "i32"],
      returns: "i32",
    },

    /**
     * Get edge detection.
     * @param settings Line settings object
     * @returns Current edge detection setting
     */
    gpiod_line_settings_get_edge_detection: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Set bias.
     * @param settings Line settings object
     * @param bias Bias setting (GPIOD_LINE_BIAS_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_settings_set_bias: {
      args: ["pointer", "i32"],
      returns: "i32",
    },

    /**
     * Get bias.
     * @param settings Line settings object
     * @returns Current bias setting
     */
    gpiod_line_settings_get_bias: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Set drive.
     * @param settings Line settings object
     * @param drive Drive setting (GPIOD_LINE_DRIVE_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_settings_set_drive: {
      args: ["pointer", "i32"],
      returns: "i32",
    },

    /**
     * Get drive.
     * @param settings Line settings object
     * @returns Current drive setting
     */
    gpiod_line_settings_get_drive: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Set active-low setting.
     * @param settings Line settings object
     * @param active_low True to enable active-low
     */
    gpiod_line_settings_set_active_low: {
      args: ["pointer", "bool"],
      returns: "void",
    },

    /**
     * Get active-low setting.
     * @param settings Line settings object
     * @returns True if active-low is enabled, false otherwise
     */
    gpiod_line_settings_get_active_low: {
      args: ["pointer"],
      returns: "bool",
    },

    /**
     * Set debounce period.
     * @param settings Line settings object
     * @param period Debounce period in microseconds
     */
    gpiod_line_settings_set_debounce_period_us: {
      args: ["pointer", "u64"],
      returns: "void",
    },

    /**
     * Get debounce period.
     * @param settings Line settings object
     * @returns Current debounce period in microseconds
     */
    gpiod_line_settings_get_debounce_period_us: {
      args: ["pointer"],
      returns: "u64",
    },

    /**
     * Set event clock.
     * @param settings Line settings object
     * @param event_clock Event clock setting (GPIOD_LINE_CLOCK_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_settings_set_event_clock: {
      args: ["pointer", "i32"],
      returns: "i32",
    },

    /**
     * Get event clock.
     * @param settings Line settings object
     * @returns Current event clock setting
     */
    gpiod_line_settings_get_event_clock: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Set output value.
     * @param settings Line settings object
     * @param value Output value (GPIOD_LINE_VALUE_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_settings_set_output_value: {
      args: ["pointer", "i32"],
      returns: "i32",
    },

    /**
     * Get output value.
     * @param settings Line settings object
     * @returns Current output value setting
     */
    gpiod_line_settings_get_output_value: {
      args: ["pointer"],
      returns: "i32",
    },

    // =========================================================================
    // Line Config Operations
    // =========================================================================

    /**
     * Create a new line config object.
     * @returns New line config object or NULL on error.
     *          Must be freed using gpiod_line_config_free.
     */
    gpiod_line_config_new: {
      args: [],
      returns: "pointer",
    },

    /**
     * Free the line config object and release all associated resources.
     * @param config Line config object to free
     */
    gpiod_line_config_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Reset the line config object.
     * @param config Line config object to reset
     */
    gpiod_line_config_reset: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Add line settings for a set of offsets.
     * @param config Line config object
     * @param offsets Array of line offsets
     * @param num_offsets Number of offsets in the array
     * @param settings Line settings to apply
     * @returns 0 on success, -1 on error
     */
    gpiod_line_config_add_line_settings: {
      args: ["pointer", "pointer", "usize", "pointer"],
      returns: "i32",
    },

    /**
     * Get line settings for offset.
     * @param config Line config object
     * @param offset Line offset to get settings for
     * @returns New line settings object (must be freed by the caller) or NULL on error
     */
    gpiod_line_config_get_line_settings: {
      args: ["pointer", "u32"],
      returns: "pointer",
    },

    /**
     * Set output values for a number of lines.
     * @param config Line config object
     * @param values Array of output values
     * @param num_values Number of values in the array
     * @returns 0 on success, -1 on error
     */
    gpiod_line_config_set_output_values: {
      args: ["pointer", "pointer", "usize"],
      returns: "i32",
    },

    /**
     * Get the number of configured line offsets.
     * @param config Line config object
     * @returns Number of offsets for which line settings have been added
     */
    gpiod_line_config_get_num_configured_offsets: {
      args: ["pointer"],
      returns: "usize",
    },

    /**
     * Get configured offsets.
     * @param config Line config object
     * @param offsets Array to store offsets
     * @param max_offsets Maximum number of offsets to store
     * @returns Number of offsets stored in the offsets array
     */
    gpiod_line_config_get_configured_offsets: {
      args: ["pointer", "pointer", "usize"],
      returns: "usize",
    },

    // =========================================================================
    // Request Config Operations
    // =========================================================================

    /**
     * Create a new request config object.
     * @returns New request config object or NULL on error.
     *          Must be freed using gpiod_request_config_free.
     */
    gpiod_request_config_new: {
      args: [],
      returns: "pointer",
    },

    /**
     * Free the request config object and release all associated resources.
     * @param config Request config object to free
     */
    gpiod_request_config_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Set the consumer name for the request.
     * @param config Request config object
     * @param consumer Consumer name string
     */
    gpiod_request_config_set_consumer: {
      args: ["pointer", "cstring"],
      returns: "void",
    },

    /**
     * Get the consumer name for the request.
     * @param config Request config object
     * @returns Consumer name string
     */
    gpiod_request_config_get_consumer: {
      args: ["pointer"],
      returns: "cstring",
    },

    /**
     * Set the size of the kernel event buffer for the request.
     * @param config Request config object
     * @param event_buffer_size Size of the kernel event buffer
     */
    gpiod_request_config_set_event_buffer_size: {
      args: ["pointer", "usize"],
      returns: "void",
    },

    /**
     * Get the size of the kernel event buffer for the request.
     * @param config Request config object
     * @returns Size of the kernel event buffer
     */
    gpiod_request_config_get_event_buffer_size: {
      args: ["pointer"],
      returns: "usize",
    },

    // =========================================================================
    // Line Request Operations
    // =========================================================================

    /**
     * Release the requested lines and free all associated resources.
     * @param request Line request object
     */
    gpiod_line_request_release: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Get the number of lines in the request.
     * @param request Line request object
     * @returns Number of requested lines
     */
    gpiod_line_request_get_num_requested_lines: {
      args: ["pointer"],
      returns: "usize",
    },

    /**
     * Get the offsets of the lines in the request.
     * @param request Line request object
     * @param offsets Array to store offsets
     * @param max_offsets Maximum number of offsets to store
     * @returns Number of offsets stored in the offsets array
     */
    gpiod_line_request_get_requested_offsets: {
      args: ["pointer", "pointer", "usize"],
      returns: "usize",
    },

    /**
     * Get the value of a single requested line.
     * @param request Line request object
     * @param offset Offset of the line
     * @returns 1 or 0 on success and -1 on error
     */
    gpiod_line_request_get_value: {
      args: ["pointer", "u32"],
      returns: "i32",
    },

    /**
     * Get the values of a subset of requested lines.
     * @param request Line request object
     * @param num_values Number of lines
     * @param offsets Array of line offsets
     * @param values Array to store values
     * @returns 0 on success, -1 on error
     */
    gpiod_line_request_get_values_subset: {
      args: ["pointer", "usize", "pointer", "pointer"],
      returns: "i32",
    },

    /**
     * Get the values of all requested lines.
     * @param request Line request object
     * @param values Array to store values (must be sized for all requested lines)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_request_get_values: {
      args: ["pointer", "pointer"],
      returns: "i32",
    },

    /**
     * Set the value of a single requested line.
     * @param request Line request object
     * @param offset Offset of the line
     * @param value Value to set (GPIOD_LINE_VALUE_*)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_request_set_value: {
      args: ["pointer", "u32", "i32"],
      returns: "i32",
    },

    /**
     * Set the values of a subset of requested lines.
     * @param request Line request object
     * @param num_values Number of lines
     * @param offsets Array of line offsets
     * @param values Array of values to set
     * @returns 0 on success, -1 on error
     */
    gpiod_line_request_set_values_subset: {
      args: ["pointer", "usize", "pointer", "pointer"],
      returns: "i32",
    },

    /**
     * Set the values of all requested lines.
     * @param request Line request object
     * @param values Array of values to set (must be sized for all requested lines)
     * @returns 0 on success, -1 on error
     */
    gpiod_line_request_set_values: {
      args: ["pointer", "pointer"],
      returns: "i32",
    },

    /**
     * Update the configuration of requested lines.
     * @param request Line request object
     * @param line_cfg New line configuration
     * @returns 0 on success, -1 on error
     */
    gpiod_line_request_reconfigure_lines: {
      args: ["pointer", "pointer"],
      returns: "i32",
    },

    /**
     * Get the file descriptor associated with the line request.
     * @param request Line request object
     * @returns File descriptor number
     */
    gpiod_line_request_get_fd: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Wait for edge events on any of the requested lines.
     * @param request Line request object
     * @param timeout_ns Wait time limit in nanoseconds. 0 = immediate return,
     *                   negative = block indefinitely
     * @returns 0 if wait timed out, 1 if event is pending, -1 on error
     */
    gpiod_line_request_wait_edge_events: {
      args: ["pointer", "i64"],
      returns: "i32",
    },

    /**
     * Read a number of edge events from a line request.
     * @param request Line request object
     * @param buffer Edge event buffer
     * @param max_events Maximum number of events to read
     * @returns Number of events read on success, -1 on error
     */
    gpiod_line_request_read_edge_events: {
      args: ["pointer", "pointer", "usize"],
      returns: "i32",
    },

    // =========================================================================
    // Edge Event Buffer Operations
    // =========================================================================

    /**
     * Create a new edge event buffer.
     * @param capacity Maximum number of events the buffer can hold (0 = default 64,
     *                 max 1024)
     * @returns New edge event buffer or NULL on error
     */
    gpiod_edge_event_buffer_new: {
      args: ["usize"],
      returns: "pointer",
    },

    /**
     * Get the capacity of the event buffer.
     * @param buffer Edge event buffer
     * @returns The capacity of the buffer
     */
    gpiod_edge_event_buffer_get_capacity: {
      args: ["pointer"],
      returns: "usize",
    },

    /**
     * Free the edge event buffer and release all associated resources.
     * @param buffer Edge event buffer to free
     */
    gpiod_edge_event_buffer_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Get an event stored in the buffer.
     * @param buffer Edge event buffer
     * @param index Index of the event to get
     * @returns Pointer to an event stored in the buffer. The lifetime is tied
     *          to the buffer object. Users must not free it.
     */
    gpiod_edge_event_buffer_get_event: {
      args: ["pointer", "u64"],
      returns: "pointer",
    },

    /**
     * Get the number of events a buffer has stored.
     * @param buffer Edge event buffer
     * @returns Number of events stored in the buffer
     */
    gpiod_edge_event_buffer_get_num_events: {
      args: ["pointer"],
      returns: "usize",
    },

    // =========================================================================
    // Edge Event Operations
    // =========================================================================

    /**
     * Free the edge event object and release all associated resources.
     * @param event Edge event object to free
     */
    gpiod_edge_event_free: {
      args: ["pointer"],
      returns: "void",
    },

    /**
     * Copy the edge event object.
     * @param event Edge event object to copy
     * @returns Copy of the edge event or NULL on error.
     *          Must be freed using gpiod_edge_event_free.
     */
    gpiod_edge_event_copy: {
      args: ["pointer"],
      returns: "pointer",
    },

    /**
     * Get the event type.
     * @param event Edge event object
     * @returns Event type (GPIOD_EDGE_EVENT_*)
     */
    gpiod_edge_event_get_event_type: {
      args: ["pointer"],
      returns: "i32",
    },

    /**
     * Get the timestamp of the event.
     * @param event Edge event object
     * @returns Timestamp in nanoseconds
     */
    gpiod_edge_event_get_timestamp_ns: {
      args: ["pointer"],
      returns: "u64",
    },

    /**
     * Get the offset of the line which triggered the event.
     * @param event Edge event object
     * @returns Line offset
     */
    gpiod_edge_event_get_line_offset: {
      args: ["pointer"],
      returns: "u32",
    },

    /**
     * Get the global sequence number of the event.
     * @param event Edge event object
     * @returns Sequence number of the event in the series of events for all lines
     *          in the associated line request
     */
    gpiod_edge_event_get_global_seqno: {
      args: ["pointer"],
      returns: "u64",
    },

    /**
     * Get the line sequence number of the event.
     * @param event Edge event object
     * @returns Sequence number of the event in the series of events only for
     *          this line within the lifetime of the line request
     */
    gpiod_edge_event_get_line_seqno: {
      args: ["pointer"],
      returns: "u64",
    },
  });
}

// =============================================================================
// Type Exports
// =============================================================================

/** Type for the loaded libgpiod library */
export type Libgpiod = ReturnType<typeof loadLibgpiod>;
