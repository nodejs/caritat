<script>
    import { onMount } from 'svelte';
    import './index.css';
  
    export let variant = 'primary';
    export let className = '';
    export let disabled = false;
    export let onClick;
    export let type = 'button';
  
    let buttonClass = '';
  
    onMount(() => {
      buttonClass = `button ${variant} ${className}`;
    });
  </script>
  
  <button 
    type={type}
    class={buttonClass}
    on:click={onClick}
    {disabled}>
    <slot></slot>
  </button>
  