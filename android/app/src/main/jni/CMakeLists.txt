cmake_minimum_required(VERSION 3.13)

# This is the project name that React Native expects — do not change.
project(appmodules)

# Include React Native's standard app setup (builds libappmodules.so with
# autolinking, TurboModules, Fabric, etc.)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# --- Inference Service JNI library ---

set(LLAMA_RN_DIR "${CMAKE_SOURCE_DIR}/../../../../../node_modules/llama.rn")

# Import prebuilt librnllama.so
add_library(rnllama SHARED IMPORTED)
set_target_properties(rnllama PROPERTIES
    IMPORTED_LOCATION "${LLAMA_RN_DIR}/android/src/main/jniLibs/${ANDROID_ABI}/librnllama.so"
)

# Build our thin JNI wrapper
add_library(inference_service SHARED
    ${CMAKE_SOURCE_DIR}/../cpp/inference_jni.cpp
)

target_include_directories(inference_service PRIVATE
    ${LLAMA_RN_DIR}/cpp
    ${LLAMA_RN_DIR}/cpp/common
)

target_link_libraries(inference_service
    rnllama
    android
    log
)
