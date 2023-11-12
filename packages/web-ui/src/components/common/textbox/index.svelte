<script>
    import { InformationCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon } from '../../icons';
    import './index.css';

    export let variant = 'info';
  
    let title;
    let icon;
  
    // Set icon and title based on the variant
    $: {
      switch (variant) {
        case 'info':
          icon = InformationCircleIcon;
          title = 'Info';
          break;
        case 'warning':
          icon = ExclamationTriangleIcon;
          title = 'Warning';
          break;
        case 'error':
          icon = ExclamationCircleIcon;
          title = 'Error';
          break;
        default:
          icon = null;
          title = null;
      }
    }
  </script>
  
  <div class={`container ${variant}`}>
    {#if variant !== 'default'}
      <div class="top">
        {#if icon}
          <svelte:component this={icon} />
        {/if}
        <strong>{title}</strong>
      </div>
    {/if}
    <slot></slot>
  </div>
