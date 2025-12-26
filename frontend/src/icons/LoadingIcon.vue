<template>
  <div class="spinner center scale-50">
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
  </div>
</template>
<style lang="sass">
$spinner-color: #888 !default
$spinner-size: 48px !default

.spinner
  font-size: $spinner-size
  position: relative
  display: inline-block
  width: 1em
  height: 1em

  .spinner-blade
    position: absolute
    left: .4629em
    bottom: 0
    width: .074em
    height: .2777em
    border-radius: .0555em
    background-color: transparent
    transform-origin: center -.2222em
    animation: spinner-fade 1s infinite linear
    $animation-delay: 0s
    $blade-rotation: 0deg
    @for $i from 1 through 12
      &:nth-child(#{$i})
        animation-delay: $animation-delay
        transform: rotate($blade-rotation)
        $blade-rotation: $blade-rotation + 30
        $animation-delay: $animation-delay + .083
@keyframes spinner-fade
  0%
    background-color: $spinner-color
  100%
    background-color: transparent
</style>
