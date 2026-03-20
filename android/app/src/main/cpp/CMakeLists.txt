cmake_minimum_required(VERSION 3.22)
project(inference_service)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Path to llama.rn within node_modules
set(LLAMA_RN_DIR "${CMAKE_SOURCE_DIR}/../../../../../node_modules/llama.rn")

# Import prebuilt librnllama.so from llama.rn's build output
add_library(rnllama SHARED IMPORTED)
set_target_properties(rnllama PROPERTIES
    IMPORTED_LOCATION "${LLAMA_RN_DIR}/android/src/main/jniLibs/${ANDROID_ABI}/librnllama.so"
)

# Build our thin JNI wrapper
add_library(inference_service SHARED
    inference_jni.cpp
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
