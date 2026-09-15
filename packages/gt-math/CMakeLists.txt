cmake_minimum_required(VERSION 3.20)
project(gt_math LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(GT_MATH_SOURCES
  src/pearson.cpp
  src/drawdown.cpp
  src/align.cpp
  src/backtest.cpp
)

add_library(gt_math_core STATIC ${GT_MATH_SOURCES})
target_include_directories(gt_math_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include")

if(EMSCRIPTEN)
  add_executable(gt_math ${GT_MATH_SOURCES})
  target_include_directories(gt_math PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include")
  target_compile_options(gt_math PRIVATE -fno-exceptions -fno-rtti -O2)
  target_link_options(gt_math PRIVATE
    "SHELL:-s MODULARIZE=1"
    "SHELL:-s EXPORT_ES6=1"
    "SHELL:-s ENVIRONMENT=web,worker,node"
    "SHELL:-s ALLOW_MEMORY_GROWTH=1"
    "SHELL:-s FILESYSTEM=0"
    "SHELL:-s NO_EXIT_RUNTIME=1"
    "SHELL:-s EXPORT_NAME=createGtMath"
    "SHELL:-s EXPORTED_FUNCTIONS=['_malloc','_free','_gt_pearson','_gt_rolling_pearson','_gt_max_drawdown','_gt_align_ticks','_gt_run_backtest']"
    "SHELL:-s EXPORTED_RUNTIME_METHODS=['HEAPF64','HEAP32']"
    -O2
  )
  set_target_properties(gt_math PROPERTIES SUFFIX ".js")
endif()
